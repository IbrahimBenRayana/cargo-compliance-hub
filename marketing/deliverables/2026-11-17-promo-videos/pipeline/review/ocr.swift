// swift review/ocr.swift <dir-of-pngs>  → prints "<file>\t<text>" per recognised line (on-device Vision, accurate mode)
import Foundation
import Vision
import AppKit

let dir = URL(fileURLWithPath: CommandLine.arguments[1])
let files = try FileManager.default.contentsOfDirectory(at: dir, includingPropertiesForKeys: nil)
    .filter { $0.pathExtension == "png" }.sorted { $0.lastPathComponent < $1.lastPathComponent }
for file in files {
    guard let image = NSImage(contentsOf: file), let cg = image.cgImage(forProposedRect: nil, context: nil, hints: nil) else { continue }
    let request = VNRecognizeTextRequest()
    request.recognitionLevel = .accurate
    request.usesLanguageCorrection = false
    try VNImageRequestHandler(cgImage: cg).perform([request])
    for obs in request.results ?? [] {
        if let text = obs.topCandidates(1).first?.string { print("\(file.lastPathComponent)\t\(text)") }
    }
}
