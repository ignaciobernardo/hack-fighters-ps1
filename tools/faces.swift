// Puntos de la cara con Vision (macOS), para mapear la foto sobre la cabeza low-poly.
// uso: swift tools/faces.swift foto1.png foto2.png ...   → JSON por línea: {file, ok, eyeL, eyeR, mouth, chin, nose, box}
// Coordenadas normalizadas con origen arriba a la izquierda (como en el canvas).
import Foundation
import Vision
import AppKit

func pt(_ p: CGPoint, _ box: CGRect) -> [Double] {
  // landmarks vienen relativos a la caja de la cara, origen abajo-izquierda
  let x = box.origin.x + p.x * box.size.width
  let y = box.origin.y + p.y * box.size.height
  return [Double(x), Double(1 - y)]
}
func center(_ r: VNFaceLandmarkRegion2D?, _ box: CGRect) -> [Double]? {
  guard let r = r, r.pointCount > 0 else { return nil }
  var sx = 0.0, sy = 0.0
  for p in r.normalizedPoints { let q = pt(p, box); sx += q[0]; sy += q[1] }
  return [sx / Double(r.pointCount), sy / Double(r.pointCount)]
}

for path in CommandLine.arguments.dropFirst() {
  var out: [String: Any] = ["file": path, "ok": false]
  defer {
    let d = try! JSONSerialization.data(withJSONObject: out, options: [.sortedKeys])
    print(String(data: d, encoding: .utf8)!)
  }
  guard let img = NSImage(contentsOfFile: path),
        let cg = img.cgImage(forProposedRect: nil, context: nil, hints: nil) else { continue }
  let req = VNDetectFaceLandmarksRequest()
  let h = VNImageRequestHandler(cgImage: cg, options: [:])
  try? h.perform([req])
  guard let faces = req.results, !faces.isEmpty else { continue }
  // la cara más grande
  let f = faces.max { $0.boundingBox.width * $0.boundingBox.height < $1.boundingBox.width * $1.boundingBox.height }!
  let box = f.boundingBox
  out["box"] = [Double(box.minX), Double(1 - box.maxY), Double(box.width), Double(box.height)]
  out["roll"] = f.roll?.doubleValue ?? 0
  out["yaw"] = f.yaw?.doubleValue ?? 0
  guard let lm = f.landmarks else { continue }
  // ojo izquierdo de la imagen (derecho de la persona) primero
  if let a = center(lm.leftEye, box), let b = center(lm.rightEye, box) {
    out["eyeL"] = a[0] < b[0] ? a : b
    out["eyeR"] = a[0] < b[0] ? b : a
  }
  if let m = center(lm.outerLips, box) { out["mouth"] = m }
  if let n = center(lm.nose, box) { out["nose"] = n }
  if let c = lm.faceContour, c.pointCount > 0 {
    let pts = c.normalizedPoints.map { pt($0, box) }
    out["chin"] = pts.max { $0[1] < $1[1] }!
    out["jawL"] = pts.min { $0[0] < $1[0] }!
    out["jawR"] = pts.max { $0[0] < $1[0] }!
  }
  out["ok"] = out["eyeL"] != nil && out["mouth"] != nil
}
