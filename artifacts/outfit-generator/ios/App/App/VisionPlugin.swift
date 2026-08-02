import Capacitor
import Vision
import UIKit

/// VisionPlugin — analyses a base64-encoded image with Apple Vision framework.
///
/// Called from JS:  VisionPlugin.analyzeImage({ imageBase64: "..." })
/// Returns:         { labels: string[], text: string[] }
///
/// Both requests run on a background queue; errors are swallowed and empty
/// arrays are returned so JS always gets a valid response.
@objc(VisionPlugin)
public class VisionPlugin: CAPPlugin {

    @objc func analyzeImage(_ call: CAPPluginCall) {
        guard
            let base64 = call.getString("imageBase64"),
            let data   = Data(base64Encoded: base64,
                               options: .ignoreUnknownCharacters),
            let ciImg  = CIImage(data: data)
        else {
            call.resolve(["labels": [String](), "text": [String]()])
            return
        }

        DispatchQueue.global(qos: .userInitiated).async {
            var labels:  [String] = []
            var text:    [String] = []

            let group = DispatchGroup()

            // ── Classify ──────────────────────────────────────────────────────
            group.enter()
            let classifyReq = VNClassifyImageRequest { req, _ in
                defer { group.leave() }
                labels = (req.results as? [VNClassificationObservation] ?? [])
                    .filter { $0.confidence >= 0.3 }
                    .map    { $0.identifier }
            }

            // ── Recognise text ────────────────────────────────────────────────
            group.enter()
            let textReq = VNRecognizeTextRequest { req, _ in
                defer { group.leave() }
                text = (req.results as? [VNRecognizedTextObservation] ?? [])
                    .compactMap { $0.topCandidates(1).first?.string }
            }
            textReq.recognitionLevel = .accurate

            let handler = VNImageRequestHandler(ciImage: ciImg, options: [:])
            try? handler.perform([classifyReq, textReq])

            group.wait()
            call.resolve(["labels": labels, "text": text])
        }
    }
}
