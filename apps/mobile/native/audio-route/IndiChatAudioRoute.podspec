Pod::Spec.new do |s|
  s.name = 'IndiChatAudioRoute'
  s.version = '1.0.0'
  s.summary = 'IndiChat communication audio routing'
  s.homepage = 'https://github.com/adityakalambe01/IndiChat'
  s.license = 'MIT'
  s.author = 'IndiChat'
  s.source = { :git => s.homepage }
  s.platform = :ios, '16.4'
  s.source_files = '*.{h,m}'
  s.dependency 'React-Core'
  s.dependency 'JitsiWebRTC', '~> 155.0.0'
  s.framework = 'AVFoundation'
end
