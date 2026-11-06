// Only the React transport boundary is stubbed. The production routing class,
// RTCAudioSession, AVAudioSession, AudioUnit, microphone and RTP are native.
#import <Foundation/Foundation.h>
@protocol RCTBridgeModule <NSObject>
@end
typedef void (^RCTPromiseResolveBlock)(id);
typedef void (^RCTPromiseRejectBlock)(NSString *, NSString *, NSError *);
#define RCT_EXPORT_MODULE(name)
#define RCT_REMAP_METHOD(js_name, method) - (void)method
