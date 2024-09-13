import Message from "../bo/Message";
import UserInfo from "../bo/UserInfo";

class Group {
	constructor(channel) {
		this.channel = channel;
		this.currUser = null;
		this._socket = null;
		this.otherUsers = [];
	}

	start() {
		const that = this;
		const url = (location.protocol == 'https:' ? 'wss://' : 'ws://') + location.host + '/video/conference/websocket/' + this.channel;
		// const url = (location.protocol == 'https:' ? 'wss://' : 'ws://') + '192.168.8.75:9900' + '/video/conference/websocket/' + this.channel;
		let socket = this._socket = new WebSocket(url);

		socket.on = function (name, callback) {
			if (!this.event) {
				this.event = {};
			}
			this.event[name] = callback;
		};

		socket.onmessage = function (event) {
			const data = JSON.parse(event.data);
			let message = new Message(data);
			that.treckEventListener && that.treckEventListener(message);
			console.log(message)
			this.event[message.getType()] && this.event[message.getType()].call(this, message);
		};

		socket.emit = (message) => {
			socket.send(JSON.stringify(message));
		}

		socket.onclose = () => {
			console.log('websocket closed')
		}

		socket.on('init', m => {
			const userInfo = new UserInfo(m.getData());
			that.currUser = userInfo;

			const message = new Message();
			message.setType('join');
			message.setData(userInfo);
			this._socket.emit(message);

			that.connectEventListener && that.connectEventListener(userInfo);
		});

		socket.on('join', m => {
			const userInfo = new UserInfo(m.getData());
			this.otherUsers.push(userInfo);

			let connect = that.createConnection();
			let rtcDataChannel = connect.createDataChannel('sendDataChannel', null);
			userInfo.setDataChannel(rtcDataChannel);
			userInfo.setConnect(connect);

			let message = new Message();
			message.setType('receive');
			message.setData(that.getCurrentUser());
			message.setReceiver(userInfo.getId());
			this._socket.emit(message);

			that.joinEventListener && that.joinEventListener(userInfo);
		})

		socket.on('receive', m => {
			const userInfo = new UserInfo(m.getData());
			this.otherUsers.push(userInfo);

			let connect = that.createConnection();
			let rtcDataChannel = connect.createDataChannel('sendDataChannel', null);
			userInfo.setDataChannel(rtcDataChannel);
			userInfo.setConnect(connect);
			connect.createOffer().then(function (sessionDescription) {
				connect.setLocalDescription(sessionDescription);
				let message = new Message();
				message.setType('rtc');
				message.setData(sessionDescription);
				message.setReceiver(userInfo.getId());
				that._socket.emit(message);
			});

			that.joinEventListener && that.joinEventListener(userInfo);
		});

		socket.on('rtc', message => {
			const data = message.getData();
			const sender = message.getSender();
			let userInfo = that.getUserInfo(sender);
			if (data.type === 'offer') {
				const connect = userInfo.getConnect();
				connect.setRemoteDescription(new RTCSessionDescription(data));
				connect.createAnswer().then(function (sessionDescription) {
					connect.setLocalDescription(sessionDescription);
					let message = new Message();
					message.setType('rtc');
					message.setData(sessionDescription);
					message.setReceiver(sender);
					that._socket.emit(message);
				});
			} else if (data.type === 'answer') {
				userInfo.getConnect().setRemoteDescription(new RTCSessionDescription(data));
			} else if (data.type === 'candidate') {
				const candidate = new RTCIceCandidate({
					sdpMLineIndex: data.label, candidate: data.candidate, sender: sender
				});
				userInfo.getConnect().addIceCandidate(candidate);
			}
		})

		socket.on('leave', message => {
			let sender = message.getSender();
			let index = that.otherUsers.findIndex(user => user.getId() === sender);
			if (index !== -1) {
				let userInfo = that.otherUsers[index];
				userInfo.dispose();
				that.otherUsers.splice(index, 1);
				this.leaveEventListener && this.leaveEventListener(userInfo);
			}
		})
	}

	onTrack(event) {
		this.treckEventListener = event;
		return this;
	}

	onConnect(event) {
		this.connectEventListener = event;
		return this;
	}

	onJoin(event) {
		this.joinEventListener = event;
		return this;
	}

	onLeave(event) {
		this.leaveEventListener = event;
		return this;
	}

	onMessage(event) {
		this.messageEventListener = event;
		return this;
	}

	onSharedScreen(event) {
		this.sharedScreenEventListener = event;
		return this;
	}

	sendText(text) {
		let message = new Message();
		message.setType('text');
		message.setData(text);
		this.otherUsers.forEach(user => {
			let dataChannel = user.getDataChannel();
			if (dataChannel && dataChannel.readyState === 'open') {
				dataChannel.send(JSON.stringify(message));
			}
		});
	}

	shareScreen(stream) {
		const that = this;
		this.otherUsers.forEach(user => {
			let connect = user.getConnect();
			// connect.addStream(stream);
			stream.getTracks().forEach(track => {
				connect.addTrack(track, stream);
			})

			connect.createOffer().then(function (sessionDescription) {
				connect.setLocalDescription(sessionDescription);
				let message = new Message();
				message.setType('rtc');
				message.setData(sessionDescription);
				message.setReceiver(user.getId());
				that._socket.emit(message);
			});


		})
	}

	getCurrentUser() {
		return this.currUser;
	}

	getOtherUsers() {
		return this.otherUsers;
	}

	getUserInfo(userId) {
		return this.otherUsers.find(user => user.getId() === userId);
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
				message.setReceiver(event.candidate.sender)
				that._socket.emit(message);
			} else {
				console.log('End of candidates.');
			}
		}
		// connect.onaddstream = (event) => {
		// 	that.sharedScreenEventListener && that.sharedScreenEventListener(event.stream);
		// }

		// if(that.localStream){
		// 	connect.addStream(that.localStream)
		// }

		connect.ontrack = (event) => {
			console.log('receive track', event.track);
			const remoteStream = new MediaStream();
			// 将轨道添加到远程流
			event.streams[0].getTracks().forEach(track => {
				remoteStream.addTrack(track);
			});
			that.sharedScreenEventListener && that.sharedScreenEventListener(remoteStream);
		}

		connect.onremovetrack = (event) => {
			console.log('remove track', event.track);
		}

		connect.onremovestream = (event) => {
			console.log('remove stream', event.stream);
		}
		connect.ondatachannel = (event) => {
			const receiveChannel = event.channel;
			receiveChannel.onmessage = (event) => {
				console.log('receive data channel message', event.data);
				that.messageEventListener && that.messageEventListener(new Message(JSON.parse(event.data)))
			}
		}
		return connect;
	}
}

export default Group;