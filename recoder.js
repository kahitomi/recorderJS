// 录音接口
.factory('$record', function(){
	navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia;
	
	var inited = false,
		recording = false,
		audioCtx = {},
		volume = {},
		recorder = {},
		localStream = {},
		source = {},
		leftchannel = [],
		rightchannel = [],
		recordingLength = 0,
		bufferSize = 2048,
		sampleRate = 0,
		mergeBuffers = function(channelBuffer, recordingLength){
			var result = new Float32Array(recordingLength),
				offset = 0,
				lng = channelBuffer.length;

			for (var i = 0; i < lng; i++){
				var buffer = channelBuffer[i];
				result.set(buffer, offset);
				offset += buffer.length;
			}

			return result;
		},
		interleave = function(leftChannel, rightChannel){
			var compression = 44100 / 8820,
				length = leftChannel.length / compression /*+ rightChannel.length*/,
				result = new Float32Array(length),
				inputIndex = 0;

			for (var index = 0; index < length; ){
				result[index++] = leftChannel[inputIndex];
				// result[index++] = rightChannel[inputIndex];
				inputIndex+=compression;
			}
			return result;


		},
		writeUTFBytes = function(view, offset, string){ 
			var lng = string.length;
			for (var i = 0; i < lng; i++){
				view.setUint8(offset + i, string.charCodeAt(i));
			}
		},
		wavPackaging = function(leftchannel, rightchannel, recordingLength){
			var leftBuffer = mergeBuffers ( leftchannel, recordingLength ),
				// rightBuffer = mergeBuffers ( rightchannel, recordingLength ),
			// we interleave both channels together
				interleaved = interleave ( leftBuffer/*, rightBuffer*/ ),
			 
			// create the buffer and view to create the .WAV file
				sampleRateTmp = 8820,
				sampleBits = 16,
				dataLength = interleaved.length * 2,
				channelCount = 1,
				offset = 0,
				buffer = new ArrayBuffer(44 + dataLength),
				view = new DataView(buffer);
			 
			// write the WAV container, check spec at: https://ccrma.stanford.edu/courses/422/projects/WaveFormat/
			// RIFF chunk descriptor
			writeUTFBytes(view, 0, 'RIFF');
			view.setUint32(4, 44 + dataLength, true);
			writeUTFBytes(view, 8, 'WAVE');
			// FMT sub-chunk
			writeUTFBytes(view, 12, 'fmt ');
			view.setUint32(16, 16, true);
			view.setUint16(20, 1, true);
			// stereo (2 channels)
			view.setUint16(22, channelCount, true);
			view.setUint32(24, sampleRateTmp, true);
			view.setUint32(28, sampleRateTmp * channelCount * (sampleBits / 8), true);
			view.setUint16(32, channelCount * (sampleBits / 8), true);
			view.setUint16(34, sampleBits, true);
			// data sub-chunk
			writeUTFBytes(view, 36, 'data');
			view.setUint32(40, dataLength, true);
			
			// floatTo16BitPCM(view, 44, interleaved);
			// write the PCM samples
			var lng = interleaved.length;
			var index = 44;
			var volume = 1;
			for (var i = 0; i < lng; i++){
			    view.setInt16(index, interleaved[i] * (0x7FFF * volume), true);
			    index+=2;
			    // var s = Math.max(-1, Math.min(1, interleaved[i])),
			    // 	val = s < 0 ? s * 0x8000 : s * 0x7FFF; 
			    // val = parseInt(255 / (65535 / (val + 32768)));
			    // view.setInt8(index, val, true);
			}
			 
			// our final binary blob that we can hand off
			var blob = new Blob ( [ view ], { type : 'audio/wav' } );
			return blob;
		},
		init = function(callback){
			if(!navigator.getUserMedia){
				$.warn("浏览器不支持录音");
				return false;
			}
			if(!callback){
				callback = function(){};
			}
			navigator.getUserMedia(
				{ audio: true },
				function(stream){
					localStream = stream;
					audioCtx = new (window.AudioContext || window.webkitAudioContext)();
					source = audioCtx.createMediaStreamSource(stream);
					volume = audioCtx.createGain();
					sampleRate = audioCtx.sampleRate;
					bufferSize = 2048;
					recorder = audioCtx.createScriptProcessor(bufferSize, 1, 1);
					leftchannel = [];
					rightchannel = [];
					recordingLength = 0;
					recorder.onaudioprocess = function(e){
						if(!recording){return false;}
				        var left = e.inputBuffer.getChannelData (0);
				        	// right = e.inputBuffer.getChannelData (1);
				        // we clone the samples
				        leftchannel.push (new Float32Array (left));
				        // rightchannel.push (new Float32Array (right));
				        recordingLength += bufferSize;
				    }


					source.connect(volume);
					volume.connect(recorder);
					recorder.connect(audioCtx.destination);

					inited = true;
					recording = true;
					callback(true);
				},
				function(){
					$.warn("无法使用您的麦克风");
				}
			);
		},
		start = function(callback){
			// if(!inited){
				init(callback);
			// }
			// leftchannel = [];
			// rightchannel = [];
			// recordingLength = 0;
			// recording = true;
		},
		end = function(callback){
			recording = false;
			localStream.stop();
			source.disconnect();
			volume.disconnect();
			recorder.disconnect();
			// audioCtx.close();
			var bolb = wavPackaging(leftchannel, rightchannel, recordingLength);
			callback(false, bolb);
		};
	return function(callback){
		if(recording){
			recording = false;
			end(callback);
		}
		else
		{
			start(callback);
		}
	};
})