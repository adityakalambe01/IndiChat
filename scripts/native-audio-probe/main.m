#import <UIKit/UIKit.h>
#import <AVFoundation/AVFoundation.h>
#import <AudioToolbox/AudioToolbox.h>
#import <WebRTC/WebRTC.h>
#import "../../apps/mobile/native/audio-route/IndiChatAudioRoute.m"

// Minimal raw/WebRTC comparisons, with an optional production routing bridge.
// No signaling server, mocked media, or manually-enabled audio flags.
static void Evidence(NSString *message) { fprintf(stderr, "PROBE %s\n", message.UTF8String); fflush(stderr); }
@interface Probe : UIResponder <UIApplicationDelegate, RTCPeerConnectionDelegate, RTCVideoCapturerDelegate>
@property(nonatomic, strong) UIWindow *window;
@property(nonatomic, strong) RTCPeerConnectionFactory *factory;
@property(nonatomic, strong) RTCPeerConnection *a;
@property(nonatomic, strong) RTCPeerConnection *b;
@property(nonatomic, strong) RTCAudioTrack *track;
@property(nonatomic, strong) IndiChatAudioRoute *route;
@property(nonatomic) NSInteger rounds;
@property(nonatomic,strong) RTCCameraVideoCapturer *camera;
@property(nonatomic) NSInteger frames;
@property(nonatomic, strong) NSMutableArray *earlyA;
@property(nonatomic, strong) NSMutableArray *earlyB;
@end
@implementation Probe
- (BOOL)application:(UIApplication *)app didFinishLaunchingWithOptions:(NSDictionary *)options { return YES; }
- (void)beginProbe {
  NSString *mode = NSProcessInfo.processInfo.environment[@"AUDIO_PROBE_MODE"] ?: @"webrtc";
  Evidence([@"mode=" stringByAppendingString:mode]);
  dispatch_after(dispatch_time(DISPATCH_TIME_NOW, 2*NSEC_PER_SEC), dispatch_get_main_queue(), ^{
    if ([mode isEqual:@"camera"]) { [self cameraProbe]; return; }
    if ([mode isEqual:@"raw"]) dispatch_async(dispatch_get_global_queue(QOS_CLASS_DEFAULT,0), ^{ [self rawAudio]; });
    else [self loopback:[mode isEqual:@"bridge"]];
  });
}
- (void)cameraProbe {
  NSArray<AVCaptureDevice *> *devices=[RTCCameraVideoCapturer captureDevices];
  Evidence([NSString stringWithFormat:@"camera devices=%lu",(unsigned long)devices.count]);
  for(AVCaptureDevice *device in devices) Evidence([NSString stringWithFormat:@"camera=%@ position=%ld",device.localizedName,(long)device.position]);
  if(!devices.count) { Evidence(@"FAIL no native cameras"); exit(5); }
  AVCaptureDevice *device=devices.firstObject;
  NSArray<AVCaptureDeviceFormat *> *formats=[RTCCameraVideoCapturer supportedFormatsForDevice:device];
  if(!formats.count) { Evidence(@"FAIL no capture formats"); exit(5); }
  self.camera=[[RTCCameraVideoCapturer alloc] initWithDelegate:self];
  [self.camera startCaptureWithDevice:device format:formats.firstObject fps:30 completionHandler:^(NSError *error){
    Evidence([NSString stringWithFormat:@"camera start error=%@",error]);
  }];
  dispatch_after(dispatch_time(DISPATCH_TIME_NOW,10*NSEC_PER_SEC),dispatch_get_main_queue(), ^{
    Evidence([NSString stringWithFormat:@"camera frames=%ld sessionRunning=%d",(long)self.frames,self.camera.captureSession.isRunning]);
    [self.camera stopCaptureWithCompletionHandler:^{ exit(self.frames>0 ? 0 : 6); }];
  });
}
- (void)capturer:(RTCVideoCapturer *)capturer didCaptureVideoFrame:(RTCVideoFrame *)frame {
  self.frames++;
  if(self.frames==1) Evidence([NSString stringWithFormat:@"first video frame %dx%d",frame.width,frame.height]);
}
- (void)rawAudio {
  NSError *error = nil;
  AVAudioSession *session = AVAudioSession.sharedInstance;
  BOOL ok = [session setCategory:AVAudioSessionCategoryPlayAndRecord mode:AVAudioSessionModeVoiceChat options:0 error:&error];
  if (ok) ok = [session setActive:YES error:&error];
  Evidence([NSString stringWithFormat:@"raw activate=%d error=%@",ok,error]);
  AudioComponentDescription desc = { kAudioUnitType_Output, kAudioUnitSubType_VoiceProcessingIO, kAudioUnitManufacturer_Apple,0,0 };
  AudioUnit unit = NULL;
  OSStatus status = AudioComponentInstanceNew(AudioComponentFindNext(NULL,&desc), &unit);
  UInt32 enabled=1;
  if (!status) status=AudioUnitSetProperty(unit,kAudioOutputUnitProperty_EnableIO,kAudioUnitScope_Input,1,&enabled,sizeof(enabled));
  Evidence([NSString stringWithFormat:@"raw before AudioUnitInitialize status=%d",(int)status]);
  if (!status) status=AudioUnitInitialize(unit);
  Evidence([NSString stringWithFormat:@"raw after AudioUnitInitialize status=%d",(int)status]);
  if (!status) { status=AudioOutputUnitStart(unit); Evidence([NSString stringWithFormat:@"raw started status=%d",(int)status]); AudioOutputUnitStop(unit); AudioUnitUninitialize(unit); }
  if (unit) AudioComponentInstanceDispose(unit);
  [session setActive:NO error:&error];
  exit(status ? 2 : 0);
}
- (void)loopback:(BOOL)withBridge {
  RTCInitializeSSL();
  self.factory = [[RTCPeerConnectionFactory alloc] init];
  RTCConfiguration *config=[RTCConfiguration new]; config.sdpSemantics=RTCSdpSemanticsUnifiedPlan;
  RTCMediaConstraints *constraints=[[RTCMediaConstraints alloc] initWithMandatoryConstraints:nil optionalConstraints:nil];
  self.a=[self.factory peerConnectionWithConfiguration:config constraints:constraints delegate:self];
  self.b=[self.factory peerConnectionWithConfiguration:config constraints:constraints delegate:self];
  self.earlyA=[NSMutableArray new]; self.earlyB=[NSMutableArray new];
  self.track=[self.factory audioTrackWithTrackId:@"probe-audio"];
  [self.a addTrack:self.track streamIds:@[@"probe"]];
  [self.b addTrack:[self.factory audioTrackWithTrackId:@"probe-return"] streamIds:@[@"return"]];
  if (withBridge) {
    if (!self.route) self.route=[IndiChatAudioRoute new];
    self.rounds++;
    [self.route startCallAudio:NO resolver:^(id result){ Evidence([NSString stringWithFormat:@"production bridge start=%@",result]); }
      rejecter:^(NSString *code,NSString *message,NSError *error){ Evidence(message); exit(2); }];
  }

  if (withBridge) {
    // Repeated start must not acquire a second activation owned by the bridge.
    [self.route startCallAudio:NO resolver:^(id result){ Evidence([NSString stringWithFormat:@"second start=%@",result]); } rejecter:^(NSString *c,NSString *m,NSError *e){ Evidence(m); exit(2); }];
    [self.route setSpeakerphoneOn:YES resolver:^(id result){ Evidence([NSString stringWithFormat:@"speaker requested=%@",result]); } rejecter:^(NSString *c,NSString *m,NSError *e){ Evidence(m); exit(2); }];
    [self.route setSpeakerphoneOn:NO resolver:^(id result){ Evidence([NSString stringWithFormat:@"receiver requested=%@",result]); } rejecter:^(NSString *c,NSString *m,NSError *e){ Evidence(m); exit(2); }];
  }
  [self.a offerForConstraints:constraints completionHandler:^(RTCSessionDescription *offer,NSError *error) {
    if(error) { Evidence(error.description); exit(2); }
    [self.a setLocalDescription:offer completionHandler:^(NSError *error) {
      [self.b setRemoteDescription:offer completionHandler:^(NSError *error) {
        for(RTCIceCandidate *c in self.earlyB) [self.b addIceCandidate:c]; [self.earlyB removeAllObjects];
        [self.b answerForConstraints:constraints completionHandler:^(RTCSessionDescription *answer,NSError *error) {
          [self.b setLocalDescription:answer completionHandler:^(NSError *error) {
            [self.a setRemoteDescription:answer completionHandler:^(NSError *error) {
              for(RTCIceCandidate *c in self.earlyA) [self.a addIceCandidate:c]; [self.earlyA removeAllObjects];
              Evidence([NSString stringWithFormat:@"SDP complete error=%@",error]);
            }];
          }];
        }];
      }];
    }];
  }];
  dispatch_after(dispatch_time(DISPATCH_TIME_NOW, 20*NSEC_PER_SEC), dispatch_get_main_queue(), ^{
    [self.a statisticsWithCompletionHandler:^(RTCStatisticsReport *report) {
      NSMutableArray *rtp=[NSMutableArray new];
      for(RTCStatistics *stat in report.statistics.allValues) if([stat.type containsString:@"rtp"]) [rtp addObject:@{@"type":stat.type,@"values":stat.values}];
      Evidence([NSString stringWithFormat:@"RTP=%@",rtp]);
      BOOL incoming=NO,outgoing=NO;
      for (RTCStatistics *stat in report.statistics.allValues) {
        if ([stat.type isEqual:@"inbound-rtp"] && [(NSNumber *)stat.values[@"packetsReceived"] longLongValue]>0) incoming=YES;
        if ([stat.type isEqual:@"outbound-rtp"] && [(NSNumber *)stat.values[@"packetsSent"] longLongValue]>0) outgoing=YES;
      }
      if (!incoming || !outgoing) { Evidence(@"FAIL bidirectional RTP"); exit(3); }
      [self.a close]; [self.b close]; self.track.isEnabled=NO;
      if(withBridge) [self.route stopCallAudioWithResolver:^(id result){ Evidence([NSString stringWithFormat:@"production bridge stop=%@",result]); } rejecter:^(NSString *code,NSString *message,NSError *error){ Evidence(message); exit(2); }];
      dispatch_after(dispatch_time(DISPATCH_TIME_NOW, NSEC_PER_SEC), dispatch_get_main_queue(), ^{
        if (withBridge) {
          [self.route stopCallAudioWithResolver:^(id result){} rejecter:^(NSString *c,NSString *m,NSError *e){ Evidence(m); exit(2); }];
          Evidence([NSString stringWithFormat:@"after teardown active=%d owner=%d round=%ld",RTCAudioSession.sharedInstance.isActive,self.route.audioActive,(long)self.rounds]);
          if (self.route.audioActive || RTCAudioSession.sharedInstance.isActive) { Evidence(@"FAIL activation leak"); exit(4); }
        }
        Evidence(@"teardown complete");
        if (withBridge && self.rounds<3) [self loopback:YES]; else exit(0);
      });
    }];
  });
}
- (void)peerConnection:(RTCPeerConnection *)pc didGenerateIceCandidate:(RTCIceCandidate *)candidate {
  RTCPeerConnection *other=pc==self.a ? self.b : self.a;
  if(other.remoteDescription) [other addIceCandidate:candidate];
  else [(pc==self.a ? self.earlyB : self.earlyA) addObject:candidate];
}
- (void)peerConnection:(RTCPeerConnection *)pc didChangeConnectionState:(RTCPeerConnectionState)state { Evidence([NSString stringWithFormat:@"connection=%ld",(long)state]); }
- (void)peerConnection:(RTCPeerConnection *)pc didChangeSignalingState:(RTCSignalingState)state {}
- (void)peerConnection:(RTCPeerConnection *)pc didAddStream:(RTCMediaStream *)stream {}
- (void)peerConnection:(RTCPeerConnection *)pc didRemoveStream:(RTCMediaStream *)stream {}
- (void)peerConnectionShouldNegotiate:(RTCPeerConnection *)pc {}
- (void)peerConnection:(RTCPeerConnection *)pc didChangeIceConnectionState:(RTCIceConnectionState)state {}
- (void)peerConnection:(RTCPeerConnection *)pc didChangeIceGatheringState:(RTCIceGatheringState)state {}
- (void)peerConnection:(RTCPeerConnection *)pc didRemoveIceCandidates:(NSArray<RTCIceCandidate *> *)candidates {}
- (void)peerConnection:(RTCPeerConnection *)pc didOpenDataChannel:(RTCDataChannel *)channel {}
@end
@interface ProbeScene : UIResponder <UIWindowSceneDelegate>
@property(nonatomic,strong) UIWindow *window;
@end
@implementation ProbeScene
- (void)scene:(UIScene *)scene willConnectToSession:(UISceneSession *)session options:(UISceneConnectionOptions *)options {
  self.window=[[UIWindow alloc] initWithWindowScene:(UIWindowScene *)scene];
  self.window.rootViewController=[UIViewController new];
  [self.window makeKeyAndVisible];
  [(Probe *)UIApplication.sharedApplication.delegate beginProbe];
}
@end
int main(int argc,char **argv) { @autoreleasepool { return UIApplicationMain(argc,argv,nil,NSStringFromClass(Probe.class)); } }
