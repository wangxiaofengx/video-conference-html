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
		// const url = (location.protocol == 'https:' ? 'wss://' : 'wss://') + '192.168.8.75:9900' + '/video/conference/websocket/' + this.channel;
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
			this.event[message.getType()] && this.event[message.getType()].call(this, message);
		};

		socket.emit = (message) => {
			try {
				socket.send(JSON.stringify(message));
			} catch (e) {
				console.log(e);
			}
		}

		socket.onclose = () => {
			console.log('websocket closed')
		}

		socket.on('init', m => {
			const userInfo = new UserInfo(m.getData()).setSocket(this._socket);
			that.currUser = userInfo;
			userInfo.init();
			that.connectEventListener && that.connectEventListener(userInfo);
		});

		socket.on('join', m => {
			const userInfo = new UserInfo(m.getData()).setSocket(this._socket);
			this.addUser(userInfo);
			userInfo.connect(that.getCurrentUser())
		})

		socket.on('receive', m => {
			const userInfo = new UserInfo(m.getData()).setSocket(this._socket);
			this.addUser(userInfo);
			userInfo.receive();
		});

		socket.on('rtc', message => {
			const sender = message.getSender();
			let userInfo = that.getUserInfo(sender);
			userInfo.rtc(message)
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

	onStream(event) {
		this.streamEventListener = event;
		return this;
	}

	onRemoveStream(event) {
		this.streamRemoveEventListener = event;
		return this;
	}

	addUser(userInfo) {
		this.otherUsers.push(userInfo);
		userInfo.onMessage((message) => {
			this.messageEventListener && this.messageEventListener(message, userInfo);
		})
		userInfo.onConnect(() => {
			this.joinEventListener && this.joinEventListener(userInfo);
			this.currUser.getLocalStreams().forEach(stream => {
				userInfo.addStream(stream);
			})
		})
		userInfo.onStream((stream) => {
			this.streamEventListener && this.streamEventListener(stream, userInfo);
		})
		userInfo.onRemoveStream((stream) => {
			this.streamRemoveEventListener && this.streamRemoveEventListener(stream, userInfo);
		})
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

	addStream(stream) {
		this.otherUsers.forEach(user => {
			user.addStream(stream);
		})
		this.currUser.addLocalStream(stream);
	}

	removeStream(stream) {
		this.otherUsers.forEach(user => {
			user.removeStream(stream);
		})
		this.currUser.removeLocalStream(stream);
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
}

export default Group;