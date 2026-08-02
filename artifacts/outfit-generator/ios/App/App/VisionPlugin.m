#import <Capacitor/Capacitor.h>

// Registers the plugin with the Capacitor bridge so it is discoverable from JS.
// VisionPlugin.swift is the implementation; this file is the ObjC bridge.
CAP_PLUGIN(VisionPlugin, "VisionPlugin",
    CAP_PLUGIN_METHOD(analyzeImage, CAPPluginReturnPromise);
)
