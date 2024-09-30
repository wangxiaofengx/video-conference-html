import Message from "./Message";
import adapter from 'webrtc-adapter';

class UserInfo {

	constructor(options) {
		this.dispose();
		Object.assign(this, options);
	}

	dispose() {
		if (this._dataChannel) {
			this._dataChannel.close();
		}
		if (this._connect) {
			this._connect.close();
		}
		this.id = null;
		this.name = null;
		this._connect = null;
		this._dataChannel = null;
		this._eventListener = {
			streams: [],
			removeStreams: [],
			messages: [],
			connect: [],
		};
		this._remoteStreams = [];
		this._localStream = [];
		this._socket = null;
		this._connectComplete = false;
	}

	onMessage(listener) {
		this._eventListener.messages.push(listener);
		return this;
	}

	onConnect(listener) {
		this._eventListener.connect.push(listener);
		return this;
	}

	onStream(listener) {
		this._eventListener.streams.push(listener);
		return this;
	}

	init() {
		const message = new Message();
		message.setType('join');
		message.setData(this);
		this.sendSignalingMessage(message);
	}

	connect(userInfo) {
		let connect = this.createConnection();
		let rtcDataChannel = this.createDataChannel(connect);
		this.setDataChannel(rtcDataChannel);
		this.setConnect(connect);

		let message = new Message();
		message.setType('receive');
		message.setData(userInfo);
		message.setReceiver(this.getId());
		this.sendSignalingMessage(message);
		return this;
	}

	receive() {
		let connect = this.createConnection();
		let rtcDataChannel = this.createDataChannel(connect);
		this.setDataChannel(rtcDataChannel);
		this.setConnect(connect);
		this.offer().then(r => {
		});
		return this;
	}

	rtc(message) {
		const data = message.getData();
		if (data.type === 'offer') {
			this.answer(data).then(r => {
			})
		} else if (data.type === 'answer') {
			this.answerFinish(data).then(r => {
			})
		} else if (data.type === 'candidate') {
			this.iceCandidate(data).then(r => {
			})
		}
	}

	async offer() {
		const connect = this.getConnect();
		const sessionDescription = await connect.createOffer();
		await connect.setLocalDescription(sessionDescription);
		let message = new Message();
		message.setType('rtc');
		message.setData(sessionDescription);
		message.setReceiver(this.getId());
		this.sendSignalingMessage(message);
	}

	async answer(data) {
		const connect = this.getConnect();
		await connect.setRemoteDescription(new RTCSessionDescription(data));
		const sessionDescription = await connect.createAnswer();
		await connect.setLocalDescription(sessionDescription);
		let message = new Message();
		message.setType('rtc');
		message.setData(sessionDescription);
		message.setReceiver(this.getId());
		this.sendSignalingMessage(message);
		if (!this._connectComplete) {
			this._connectComplete = true;
			this._eventListener.connect.forEach(listener => {
				listener(this);
			});
		}
	}

	async answerFinish(data) {
		await this.getConnect().setRemoteDescription(new RTCSessionDescription(data));
		if (!this._connectComplete) {
			this._connectComplete = true;
			this._eventListener.connect.forEach(listener => {
				listener(this);
			});
		}
	}

	async iceCandidate(data) {
		const candidate = new RTCIceCandidate({
			sdpMLineIndex: data.label, candidate: data.candidate
		});
		await this.getConnect().addIceCandidate(candidate);
	}

	addLocalStream(stream) {
		this._localStream.push(stream);
		return this;
	}

	removeLocalStream(stream) {
		const index = this._localStream.findIndex(s => s.id === stream.id);
		if (index !== -1) {
			this._localStream.splice(index, 1);
		}
		return this;
	}

	getLocalStreams() {
		return this._localStream;
	}

	async addStream(stream) {
		let connect = this.getConnect();
		stream.getTracks().forEach(track => {
			const sender = connect.getSenders().find(s => s.track === track);
			if (!sender) {
				connect.addTrack(track, stream);
			}
		})
		await this.offer()
	}

	async removeStream(stream) {
		let connect = this.getConnect();
		stream.getTracks().forEach(track => {
			const sender = connect.getSenders().find(s => s.track === track);
			if (sender) {
				connect.removeTrack(sender);
			}
		})
		await this.offer()
	}

	createConnection() {
		const that = this;
		const connect = new RTCPeerConnection({
			"iceServers": [{
				"url": "stun:" + location.hostname
			}, {
				"url": "turn:" + location.hostname, username: "olddriver", credential: "olddriver"
			}]
		});
		connect.onicecandidate = (event) => {
			if (event.candidate) {
				const candidate = {
					type: 'candidate',
					label: event.candidate.sdpMLineIndex,
					id: event.candidate.sdpMid,
					candidate: event.candidate.candidate
				}
				let message = new Message();
				message.setType('rtc');
				message.setData(candidate);
				message.setReceiver(that.getId())
				that.sendSignalingMessage(message);
			} else {
				console.log('End of candidates.');
			}
		}
		connect.ontrack = (event) => {
			event.streams.forEach(stream => {
				const tracks = stream.getTracks();
				that._eventListener.streams.forEach(listener => {
					listener(stream);
				});
			});

			// const addStreams = [];
			// const removeStreams = [];
			//
			// event.streams.forEach(stream => {
			// 	const oldStream = that._remoteStreams.find(s => s.id === stream.id);
			// 	if (!oldStream) {
			// 		addStreams.push(stream);
			// 	}
			// })
			//
			// that._remoteStreams.forEach(stream => {
			// 	if (!event.streams.some(s => s.id === stream.id)) {
			// 		removeStreams.push(stream);
			// 	}
			// })
			//
			// addStreams.forEach(stream => {
			// 	that._remoteStreams.push(stream);
			// 	try {
			// 		that._eventListener.streams.forEach(listener => {
			// 			listener(stream);
			// 		});
			// 	} catch (e) {
			// 		console.log(e)
			// 	}
			// })
			//
			// removeStreams.forEach(stream => {
			// 	const index = that._remoteStreams.findIndex(s => s.id === stream.id);
			// 	if (index !== -1) {
			// 		that._remoteStreams.splice(index, 1);
			// 		try {
			// 			that._eventListener.removeStreams.forEach(listener => {
			// 				listener(stream);
			// 			});
			// 		} catch (e) {
			// 			console.log(e)
			// 		}
			// 	}
			// })
		}

		connect.onremovetrack= (event) => {
			console.log('remove track', event);
		}
		return connect;
	}

	createDataChannel(connect) {
		const that = this;
		const dataChannel = connect.createDataChannel('sendDataChannel', null);
		connect.ondatachannel = (event) => {
			const receiveChannel = event.channel;
			receiveChannel.onmessage = (event) => {
				const message = new Message(JSON.parse(event.data));
				if (message.getType() == 'rtc') {
					that.rtc(message);
				} else {
					that._eventListener.messages.forEach(listener => {
						listener(message.clone());
					});
				}
			}
		}
		return dataChannel;
	}

	sendSignalingMessage(message) {
		if (this._connectComplete && this.sendMessage(message)) {
			return this;
		}
		this._socket.emit(message);
		return this;
	}

	sendMessage(message) {
		const data = JSON.stringify(message);
		let dataChannel = this.getDataChannel();
		if (dataChannel && dataChannel.readyState === 'open') {
			dataChannel.send(data);
			return true;
		}
		return false;
	}

	sendText(text) {
		let message = new Message();
		message.setType('text');
		message.setData(text);
		this.sendMessage(message);
		return this;
	}

	setId(id) {
		this.id = id;
		return this;
	}

	getId() {
		return this.id;
	}

	setName(name) {
		this.name = name;
		return this;
	}

	getName() {
		return this.name;
	}

	setConnect(connect) {
		this._connect = connect;
		return this;
	}

	getConnect() {
		return this._connect;
	}

	setDataChannel(dataChannel) {
		this._dataChannel = dataChannel;
		return this;
	}

	getDataChannel() {
		return this._dataChannel;
	}

	setSocket(socket) {
		this._socket = socket;
		return this;
	}
}

export default UserInfo;