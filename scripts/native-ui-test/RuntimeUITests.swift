import XCTest

// External acceptance driver: operates only through XCTest's public UI APIs.
// No app test hooks, media mocks, storage resets, or bypassed authentication.
final class RuntimeUITests: XCTestCase {
    func testNativeAcceptanceCommands() throws {
        continueAfterFailure = false
        let root = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0].appendingPathComponent("IndiChatAcceptance")
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        try Data("ready".utf8).write(to: root.appendingPathComponent("ready"))
        let app = XCUIApplication(bundleIdentifier: "com.indichat.app")
        app.activate()
        let deadline = Date().addingTimeInterval(600)
        var processed = Set<String>()
        while Date() < deadline {
            let files = try FileManager.default.contentsOfDirectory(at: root, includingPropertiesForKeys: nil).filter { $0.lastPathComponent.hasSuffix(".request.json") }.sorted { $0.lastPathComponent < $1.lastPathComponent }
            for file in files where !processed.contains(file.lastPathComponent) {
                processed.insert(file.lastPathComponent)
                let command = try JSONSerialization.jsonObject(with: Data(contentsOf: file)) as! [String: Any]
                let action = command["action"] as! String
                var response: [String: Any] = ["ok": true, "action": action]
                let name = command["label"] as? String ?? ""
                switch action {
                case "state": response["tree"] = app.debugDescription
                case "tap":
                    let e = app.descendants(matching: .any).matching(NSPredicate(format: "label == %@ OR identifier == %@", name, name)).firstMatch
                    XCTAssertTrue(e.waitForExistence(timeout: 5), "Missing native control: \(name)")
                    e.tap()
                case "type": app.typeText(command["text"] as! String)
                case "point": app.coordinate(withNormalizedOffset: CGVector(dx: command["x"] as! Double, dy: command["y"] as! Double)).tap()
                case "assertAbsent": XCTAssertFalse(app.buttons[name].exists, "Unexpected control: \(name)")
                case "assertPresent": XCTAssertTrue(app.buttons[name].waitForExistence(timeout: 5), "Missing control: \(name)")
                case "screenshot":
                    let screenshot = app.screenshot()
                    let path = root.appendingPathComponent(file.lastPathComponent + ".png")
                    try screenshot.pngRepresentation.write(to: path)
                    response["path"] = path.path
                    let attachment = XCTAttachment(screenshot: screenshot); attachment.lifetime = .keepAlways; add(attachment)
                case "stop":
                    try JSONSerialization.data(withJSONObject: response).write(to: root.appendingPathComponent(file.lastPathComponent.replacingOccurrences(of: ".request.json", with: ".result.json")))
                    return
                default: XCTFail("Unknown UI command \(action)")
                }
                try JSONSerialization.data(withJSONObject: response).write(to: root.appendingPathComponent(file.lastPathComponent.replacingOccurrences(of: ".request.json", with: ".result.json")))
            }
            Thread.sleep(forTimeInterval: 0.2)
        }
        XCTFail("Acceptance controller did not finish within 10 minutes")
    }
}
