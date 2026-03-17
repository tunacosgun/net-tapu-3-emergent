import Foundation
import React

/// React Native bridge — exposes LiquidGlassView as <LiquidGlassView> in JS
@objc(LiquidGlassViewManager)
class LiquidGlassViewManager: RCTViewManager {

  override func view() -> UIView! {
    return LiquidGlassView()
  }

  override static func requiresMainQueueSetup() -> Bool {
    return true
  }
}
