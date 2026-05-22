import React, { useEffect, useRef, useState } from 'react';
import { collection, doc, addDoc, onSnapshot, setDoc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { PhoneOff, Mic, MicOff, Video as VidIcon, VideoOff, Maximize, Minimize, MonitorUp } from 'lucide-react';
import { User } from '../types';

interface VideoCallProps {
  roomId: string; // The chat ID acts as the base room
  targetUser: User;
  onEnd: () => void;
}

const configuration = {
  iceServers: [
    { urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'] },
  ],
};

export function VideoCall({ roomId, targetUser, onEnd }: VideoCallProps) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peerConnection = useRef<RTCPeerConnection | null>(null);
  
  const setupMedia = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setLocalStream(stream);
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      
      const pc = new RTCPeerConnection(configuration);
      peerConnection.current = pc;
      
      stream.getTracks().forEach(track => {
        pc.addTrack(track, stream);
      });
      
      pc.ontrack = event => {
        setRemoteStream(event.streams[0]);
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = event.streams[0];
      };

      setMediaError(null);
      return pc;
    } catch (e: any) {
      console.error('Error accessing media', e);
      if (e.name === 'NotAllowedError' || e.message.includes('Permission denied')) {
        setMediaError('Camera or microphone permission was denied. Please allow access in your browser settings.');
      } else {
        setMediaError(`Error accessing media: ${e.message}`);
      }
      return null;
    }
  };

  const startCall = async () => {
    const pc = await setupMedia();
    if (!pc) return;

    const callDoc = doc(collection(db, 'calls'), roomId);
    const offerCandidates = collection(callDoc, 'offerCandidates');
    const answerCandidates = collection(callDoc, 'answerCandidates');

    pc.onicecandidate = event => {
      event.candidate && addDoc(offerCandidates, event.candidate.toJSON());
    };

    const offerDescription = await pc.createOffer();
    await pc.setLocalDescription(offerDescription);

    const offer = {
      sdp: offerDescription.sdp,
      type: offerDescription.type,
    };
    await setDoc(callDoc, { offer });

    onSnapshot(callDoc, (snapshot) => {
      const data = snapshot.data();
      if (!pc.currentRemoteDescription && data?.answer) {
        const answerDescription = new RTCSessionDescription(data.answer);
        pc.setRemoteDescription(answerDescription);
      }
    });

    onSnapshot(answerCandidates, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const candidate = new RTCIceCandidate(change.doc.data());
          pc.addIceCandidate(candidate);
        }
      });
    });
  };

  const answerCall = async () => {
    const pc = await setupMedia();
    if (!pc) return;

    const callDoc = doc(collection(db, 'calls'), roomId);
    const offerCandidates = collection(callDoc, 'offerCandidates');
    const answerCandidates = collection(callDoc, 'answerCandidates');

    pc.onicecandidate = event => {
      event.candidate && addDoc(answerCandidates, event.candidate.toJSON());
    };

    const callData = (await getDoc(callDoc)).data();
    if (!callData?.offer) {
       startCall(); 
       return;
    }

    const offerDescription = callData.offer;
    await pc.setRemoteDescription(new RTCSessionDescription(offerDescription));

    const answerDescription = await pc.createAnswer();
    await pc.setLocalDescription(answerDescription);
    const answer = { type: answerDescription.type, sdp: answerDescription.sdp };
    await updateDoc(callDoc, { answer });

    onSnapshot(offerCandidates, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          let data = change.doc.data();
          pc.addIceCandidate(new RTCIceCandidate(data));
        }
      });
    });
  };

  useEffect(() => {
    getDoc(doc(db, 'calls', roomId)).then((snap) => {
       if (snap.exists() && snap.data().offer) {
           answerCall();
       } else {
           startCall();
       }
    });

    return () => {
      localStream?.getTracks().forEach(track => track.stop());
      peerConnection.current?.close();
    };
  }, []);

  const toggleMic = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach(track => track.enabled = !isMicOn);
      setIsMicOn(!isMicOn);
    }
  };

  const toggleVideo = () => {
    if (localStream) {
      localStream.getVideoTracks().forEach(track => track.enabled = !isVideoOn);
      setIsVideoOn(!isVideoOn);
    }
  };

  const toggleScreenShare = async () => {
    if (!peerConnection.current || !localStream) return;

    try {
      if (!isScreenSharing) {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        const screenTrack = screenStream.getVideoTracks()[0];
        
        screenTrack.onended = () => {
           stopScreenShare();
        };

        const sender = peerConnection.current.getSenders().find(s => s.track?.kind === 'video');
        if (sender) {
          sender.replaceTrack(screenTrack);
        }
        
        if (localVideoRef.current) localVideoRef.current.srcObject = screenStream;
        setIsScreenSharing(true);
      } else {
        stopScreenShare();
      }
    } catch (e) {
      console.error('Error sharing screen', e);
    }
  };
  
  const stopScreenShare = () => {
    if (!peerConnection.current || !localStream) return;
    
    // Stop the existing screen tracks if they are active on the video element
    if (localVideoRef.current?.srcObject) {
       (localVideoRef.current.srcObject as MediaStream).getTracks().forEach(t => {
         if (t.kind === 'video' && localStream.getVideoTracks().indexOf(t) === -1) {
            t.stop();
         }
       });
    }

    const videoTrack = localStream.getVideoTracks()[0];
    const sender = peerConnection.current.getSenders().find(s => s.track?.kind === 'video');
    if (sender && videoTrack) {
      sender.replaceTrack(videoTrack);
    }
    
    if (localVideoRef.current) localVideoRef.current.srcObject = localStream;
    setIsScreenSharing(false);
  };

  const handleHangup = async () => {
    localStream?.getTracks().forEach(track => track.stop());
    if (localVideoRef.current?.srcObject) {
       (localVideoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
    }
    peerConnection.current?.close();
    await addDoc(collection(db, 'calls_history'), { room: roomId, endedAt: Date.now() });
    onEnd();
  };

  return (
    <div className={`fixed inset-0 z-[100] bg-slate-900 flex flex-col ${isFullscreen ? '' : 'sm:p-4'}`}>
      <div className={`relative flex-1 bg-black overflow-hidden flex items-center justify-center ${isFullscreen ? '' : 'sm:rounded-[2rem]'}`}>
        
        {/* Remote Video */}
        {mediaError ? (
           <div className="flex flex-col items-center bg-slate-800 p-6 rounded-2xl max-w-md w-full mx-4 text-center z-10">
              <div className="w-16 h-16 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center mb-4">
                <VideoOff className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Media Access Error</h3>
              <p className="text-slate-300 mb-6">{mediaError}</p>
              <button onClick={handleHangup} className="px-6 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-full transition-colors font-medium">
                Close
              </button>
           </div>
        ) : remoteStream ? (
          <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
        ) : (
          <div className="flex flex-col items-center z-10">
            <div className="w-24 h-24 rounded-full bg-slate-800 animate-pulse border-2 border-slate-700 flex items-center justify-center mb-4">
               {targetUser.photoURL ? <img src={targetUser.photoURL} className="w-full h-full rounded-full object-cover opacity-50" /> : <span className="text-white">...</span>}
            </div>
            <p className="text-white text-lg font-medium">Calling {targetUser.name}...</p>
          </div>
        )}

        {/* Local Video - PIP */}
        {!mediaError && (
          <div className={`absolute ${isFullscreen ? 'top-12 right-4' : 'top-4 right-4'} w-24 h-36 sm:w-32 sm:h-48 bg-slate-800 rounded-xl overflow-hidden border-2 border-slate-700 shadow-xl z-20`}>
            <video ref={localVideoRef} autoPlay playsInline muted className={`w-full h-full object-cover ${isVideoOn ? '' : 'hidden'}`} />
            {!isVideoOn && <div className="w-full h-full flex items-center justify-center text-slate-500"><VideoOff className="w-6 h-6" /></div>}
          </div>
        )}

        {/* Controls */}
        {!mediaError && (
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-slate-900/80 backdrop-blur-md px-6 py-4 rounded-full z-20 shadow-2xl">
            <button onClick={toggleMic} className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${isMicOn ? 'bg-slate-700 hover:bg-slate-600 text-white' : 'bg-red-500 hover:bg-red-600 text-white'}`}>
              {isMicOn ? <Mic className="w-5 h-5"/> : <MicOff className="w-5 h-5"/>}
            </button>
            
            <button onClick={handleHangup} className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center text-white shadow-lg">
              <PhoneOff className="w-6 h-6" />
            </button>
            
            <button onClick={toggleVideo} className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${isVideoOn ? 'bg-slate-700 hover:bg-slate-600 text-white' : 'bg-red-500 hover:bg-red-600 text-white'}`}>
              {isVideoOn ? <VidIcon className="w-5 h-5"/> : <VideoOff className="w-5 h-5"/>}
            </button>

            <button onClick={toggleScreenShare} className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${isScreenSharing ? 'bg-blue-500 hover:bg-blue-600' : 'bg-slate-700 hover:bg-slate-600'} text-white hidden sm:flex`}>
               <MonitorUp className="w-5 h-5" />
            </button>

            <div className="w-px h-8 bg-slate-700 mx-2"></div>
            
            <button onClick={() => setIsFullscreen(!isFullscreen)} className="w-10 h-10 rounded-full hover:bg-slate-700 text-slate-300 flex items-center justify-center">
              {isFullscreen ? <Minimize className="w-5 h-5"/> : <Maximize className="w-5 h-5"/>}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
