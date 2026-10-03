import AVFoundation
import Foundation
import Observation
import Speech

/// On-device speech-to-text using iOS 26's SpeechAnalyzer. Streams microphone audio
/// into a SpeechTranscriber, exposes the live transcript, and stops by itself after a
/// pause. Nothing leaves the phone.
@MainActor
@Observable
final class SpeechCapture {
    enum Phase: Equatable { case idle, preparing, listening, finishing, done, permissionDenied, failed(String) }

    private(set) var phase: Phase = .idle
    private(set) var finalized = ""
    private(set) var volatile = ""
    /// 0…1, for the listening animation.
    private(set) var level: Float = 0

    var transcript: String {
        (finalized + volatile).trimmingCharacters(in: .whitespacesAndNewlines)
    }

    /// Stop this long after the voice goes quiet, once something has been said.
    var pauseToFinish: TimeInterval = 3
    /// Safety net for noisy rooms (where background sound never reads as silence):
    /// also stop if no new words have appeared for this long.
    var noNewWordsLimit: TimeInterval = 4.5
    /// Mic level (0…1) above which we count it as someone speaking.
    private let voiceThreshold: Float = 0.1
    /// Give up if nothing at all is said for this long.
    var initialSilenceLimit: TimeInterval = 8

    private var analyzer: SpeechAnalyzer?
    private var input: AsyncStream<AnalyzerInput>.Continuation?
    private var resultsTask: Task<Void, Never>?
    private var watchdog: Task<Void, Never>?
    private let engine = AVAudioEngine()
    private var startedAt = Date()
    /// Last time the mic level said someone was talking.
    private var lastVoice = Date()
    /// Last time the transcript changed.
    private var lastWords = Date()

    func start() async {
        guard phase == .idle || phase == .done || phase == .permissionDenied || isFailed else { return }
        finalized = ""
        volatile = ""
        phase = .preparing

        #if DEBUG
        // Test hook: pretend this was said (the simulator can't run on-device speech).
        if let said = ProcessInfo.processInfo.environment["TADO_VOICE_TEST_TRANSCRIPT"] {
            finalized = said
            phase = .done
            return
        }
        #endif

        guard await Self.requestPermissions() else {
            phase = .permissionDenied
            return
        }

        do {
            // SpeechTranscriber is the newer, more accurate model but isn't available on every
            // device (or the simulator); DictationTranscriber is the on-device fallback.
            let module: any SpeechModule
            if SpeechTranscriber.isAvailable {
                let locale = await SpeechTranscriber.supportedLocale(equivalentTo: Locale.current)
                    ?? Locale(identifier: "en-US")
                let transcriber = SpeechTranscriber(locale: locale, preset: .progressiveTranscription)
                module = transcriber
                resultsTask = consume(transcriber.results) { (String($0.text.characters), $0.isFinal) }
            } else {
                let locale = await DictationTranscriber.supportedLocale(equivalentTo: Locale.current)
                    ?? Locale(identifier: "en-US")
                let transcriber = DictationTranscriber(locale: locale, preset: .progressiveLongDictation)
                module = transcriber
                resultsTask = consume(transcriber.results) { (String($0.text.characters), $0.isFinal) }
            }

            // The speech model is downloaded once per language, then works offline.
            if let request = try await AssetInventory.assetInstallationRequest(supporting: [module]) {
                try await request.downloadAndInstall()
            }

            guard let format = await SpeechAnalyzer.bestAvailableAudioFormat(compatibleWith: [module]) else {
                throw CaptureError("This device can't run on-device speech recognition.")
            }

            let analyzer = SpeechAnalyzer(modules: [module])
            self.analyzer = analyzer
            let (stream, continuation) = AsyncStream<AnalyzerInput>.makeStream()
            input = continuation

            try await analyzer.start(inputSequence: stream)
            try startAudio(feeding: continuation, as: format)

            startedAt = Date()
            lastVoice = Date()
            lastWords = Date()
            phase = .listening
            startWatchdog()
        } catch {
            await tearDown()
            phase = .failed(error.localizedDescription)
        }
    }

    /// Stops listening and waits for the last words to be finalized.
    func finish() async {
        guard phase == .listening else { return }
        phase = .finishing
        watchdog?.cancel()
        stopAudio()
        input?.finish()
        try? await analyzer?.finalizeAndFinishThroughEndOfInput()
        await resultsTask?.value
        await tearDown()
        if finalized.isEmpty, !volatile.isEmpty { finalized = volatile }
        volatile = ""
        phase = .done
    }

    /// Stops and throws away whatever was heard.
    func cancel() async {
        watchdog?.cancel()
        stopAudio()
        input?.finish()
        await analyzer?.cancelAndFinishNow()
        resultsTask?.cancel()
        await tearDown()
        finalized = ""
        volatile = ""
        phase = .idle
    }

    /// Folds a transcriber's results into the live transcript (finalized + in-progress text).
    private func consume<Results: AsyncSequence>(
        _ results: Results,
        _ read: @escaping (Results.Element) -> (text: String, isFinal: Bool)
    ) -> Task<Void, Never> {
        Task { [weak self] in
            do {
                for try await result in results {
                    let (text, isFinal) = read(result)
                    guard let self else { return }
                    if isFinal {
                        self.finalized += text
                        self.volatile = ""
                    } else {
                        self.volatile = text
                    }
                    self.lastWords = Date()
                }
            } catch {
                self?.phase = .failed(error.localizedDescription)
            }
        }
    }

    private var isFailed: Bool {
        if case .failed = phase { return true }
        return false
    }

    private func startWatchdog() {
        watchdog = Task { [weak self] in
            while !Task.isCancelled {
                try? await Task.sleep(for: .milliseconds(250))
                guard let self, self.phase == .listening else { return }
                let now = Date()
                let heardSomething = !self.transcript.isEmpty
                let quiet = now.timeIntervalSince(self.lastVoice) > self.pauseToFinish
                let stalled = now.timeIntervalSince(self.lastWords) > self.noNewWordsLimit
                if heardSomething, quiet || stalled {
                    await self.finish()
                    return
                }
                if !heardSomething, now.timeIntervalSince(self.startedAt) > self.initialSilenceLimit {
                    await self.finish()
                    return
                }
            }
        }
    }

    private func tearDown() async {
        stopAudio()
        input = nil
        analyzer = nil
        resultsTask = nil
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
    }

    // MARK: Audio

    private func startAudio(feeding continuation: AsyncStream<AnalyzerInput>.Continuation, as format: AVAudioFormat) throws {
        #if DEBUG
        // Test hook: feed a recorded file instead of the microphone (simulator testing).
        if let path = ProcessInfo.processInfo.environment["TADO_VOICE_TEST_FILE"] {
            try AudioFeeder.feedFile(at: URL(fileURLWithPath: path), as: format, into: continuation)
            return
        }
        #endif
        let session = AVAudioSession.sharedInstance()
        try session.setCategory(.record, mode: .measurement, options: .duckOthers)
        try session.setActive(true, options: .notifyOthersOnDeactivation)

        let node = engine.inputNode
        let micFormat = node.outputFormat(forBus: 0)
        let feeder = AudioFeeder(from: micFormat, to: format, into: continuation) { [weak self] level in
            Task { @MainActor in
                guard let self else { return }
                self.level = level
                if level > self.voiceThreshold { self.lastVoice = Date() }
            }
        }
        node.installTap(onBus: 0, bufferSize: 4096, format: micFormat) { buffer, _ in
            feeder.feed(buffer)
        }
        engine.prepare()
        try engine.start()
    }

    private func stopAudio() {
        if engine.isRunning {
            engine.stop()
            engine.inputNode.removeTap(onBus: 0)
        }
        level = 0
    }

    private static func requestPermissions() async -> Bool {
        let mic = await AVAudioApplication.requestRecordPermission()
        let speech = await withCheckedContinuation { continuation in
            SFSpeechRecognizer.requestAuthorization { continuation.resume(returning: $0 == .authorized) }
        }
        return mic && speech
    }
}

struct CaptureError: LocalizedError {
    let message: String
    init(_ message: String) { self.message = message }
    var errorDescription: String? { message }
}

/// Converts audio buffers to the analyzer's format and yields them. Runs on the audio
/// thread, so it holds no main-actor state.
final class AudioFeeder: @unchecked Sendable {
    private let converter: AVAudioConverter?
    private let format: AVAudioFormat
    private let continuation: AsyncStream<AnalyzerInput>.Continuation
    private let onLevel: (Float) -> Void

    init(from source: AVAudioFormat, to format: AVAudioFormat,
         into continuation: AsyncStream<AnalyzerInput>.Continuation,
         onLevel: @escaping (Float) -> Void = { _ in }) {
        self.converter = source == format ? nil : AVAudioConverter(from: source, to: format)
        self.format = format
        self.continuation = continuation
        self.onLevel = onLevel
    }

    func feed(_ buffer: AVAudioPCMBuffer) {
        onLevel(Self.level(of: buffer))
        guard let converter else {
            continuation.yield(AnalyzerInput(buffer: buffer))
            return
        }
        let ratio = format.sampleRate / buffer.format.sampleRate
        let capacity = AVAudioFrameCount(Double(buffer.frameLength) * ratio) + 1
        guard let output = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: capacity) else { return }
        var consumed = false
        var error: NSError?
        converter.convert(to: output, error: &error) { _, status in
            if consumed {
                status.pointee = .noDataNow
                return nil
            }
            consumed = true
            status.pointee = .haveData
            return buffer
        }
        if error == nil, output.frameLength > 0 {
            continuation.yield(AnalyzerInput(buffer: output))
        }
    }

    private static func level(of buffer: AVAudioPCMBuffer) -> Float {
        guard let samples = buffer.floatChannelData?[0], buffer.frameLength > 0 else { return 0 }
        var sum: Float = 0
        for i in 0..<Int(buffer.frameLength) { sum += samples[i] * samples[i] }
        let rms = (sum / Float(buffer.frameLength)).squareRoot()
        return min(1, rms * 12)
    }

    #if DEBUG
    static func feedFile(at url: URL, as format: AVAudioFormat,
                         into continuation: AsyncStream<AnalyzerInput>.Continuation) throws {
        let file = try AVAudioFile(forReading: url)
        let feeder = AudioFeeder(from: file.processingFormat, to: format, into: continuation)
        Task.detached {
            while file.framePosition < file.length {
                guard let buffer = AVAudioPCMBuffer(pcmFormat: file.processingFormat, frameCapacity: 4096),
                      (try? file.read(into: buffer)) != nil, buffer.frameLength > 0 else { break }
                feeder.feed(buffer)
                // Roughly real time, so the live transcript and pause detection behave as with a mic.
                try? await Task.sleep(for: .seconds(Double(buffer.frameLength) / file.processingFormat.sampleRate))
            }
        }
    }
    #endif
}
