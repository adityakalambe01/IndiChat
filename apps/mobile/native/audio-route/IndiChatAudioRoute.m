#import <React/RCTBridgeModule.h>
#import <AVFoundation/AVFoundation.h>
#import <WebRTC/RTCAudioSession.h>

@interface IndiChatAudioRoute : NSObject <RCTBridgeModule>
@property(nonatomic, assign) BOOL audioActive;
@end

@implementation IndiChatAudioRoute
RCT_EXPORT_MODULE(IndiChatAudioRoute)
+ (BOOL)requiresMainQueueSetup { return NO; }

- (NSDictionary *)routeStatus {
  AVAudioSessionPortDescription *output = AVAudioSession.sharedInstance.currentRoute.outputs.firstObject;
  NSString *port = output.portType;
  NSString *route = @"unknown";
  if ([port isEqual:AVAudioSessionPortBuiltInSpeaker]) route = @"speaker";
  else if ([port isEqual:AVAudioSessionPortBuiltInReceiver]) route = @"earpiece";
  else if ([port isEqual:AVAudioSessionPortBluetoothHFP] || [port isEqual:AVAudioSessionPortBluetoothA2DP] || [port isEqual:AVAudioSessionPortBluetoothLE]) route = @"bluetooth";
  else if ([port isEqual:AVAudioSessionPortHeadphones] || [port isEqual:AVAudioSessionPortUSBAudio]) route = @"wired";
  BOOL speaker = [route isEqual:@"speaker"];
  return @{ @"route": route, @"currentRoute": route, @"isSpeaker": @(speaker), @"isSpeakerphoneOn": @(speaker), @"success": @(![route isEqual:@"unknown"]) };
}

RCT_REMAP_METHOD(startCallAudio, startCallAudio:(BOOL)speaker resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject) {
  RTCAudioSession *session = RTCAudioSession.sharedInstance;
  [session lockForConfiguration];
  NSError *error = nil;
  BOOL ok = [session setCategory:AVAudioSessionCategoryPlayAndRecord withOptions:AVAudioSessionCategoryOptionAllowBluetooth error:&error];
  if (ok) ok = [session setMode:AVAudioSessionModeVoiceChat error:&error];
  if (ok && !self.audioActive) {
    ok = [session setActive:YES error:&error];
    if (ok) self.audioActive = YES;
  }
  if (ok) ok = [session overrideOutputAudioPort:speaker ? AVAudioSessionPortOverrideSpeaker : AVAudioSessionPortOverrideNone error:&error];
  [session unlockForConfiguration];
  if (!ok) { reject(@"audio_start", error.localizedDescription, error); return; }
  resolve([self routeStatus]);
}

RCT_REMAP_METHOD(setSpeakerphoneOn, setSpeakerphoneOn:(BOOL)speaker resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject) {
  RTCAudioSession *session = RTCAudioSession.sharedInstance;
  [session lockForConfiguration];
  NSError *error = nil;
  BOOL ok = [session overrideOutputAudioPort:speaker ? AVAudioSessionPortOverrideSpeaker : AVAudioSessionPortOverrideNone error:&error];
  [session unlockForConfiguration];
  if (!ok) { reject(@"audio_route", error.localizedDescription, error); return; }
  resolve([self routeStatus]);
}

RCT_REMAP_METHOD(getAudioRoute, getAudioRouteWithResolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject) {
  resolve([self routeStatus]);
}

RCT_REMAP_METHOD(stopCallAudio, stopCallAudioWithResolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject) {
  if (!self.audioActive) { resolve(@YES); return; }
  RTCAudioSession *session = RTCAudioSession.sharedInstance;
  [session lockForConfiguration];
  NSError *error = nil;
  BOOL ok = [session overrideOutputAudioPort:AVAudioSessionPortOverrideNone error:&error];
  // Balance our activation even if resetting the output override fails.
  NSError *deactivationError = nil;
  BOOL deactivated = [session setActive:NO error:&deactivationError];
  if (deactivated) self.audioActive = NO;
  if (!deactivated) { ok = NO; error = deactivationError; }
  [session unlockForConfiguration];
  if (!ok) { reject(@"audio_stop", error.localizedDescription, error); return; }
  resolve(@YES);
}
@end
