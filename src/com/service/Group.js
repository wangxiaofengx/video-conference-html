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

	addUser(userInfo) {
		this.otherUsers.push(userInfo);
		userInfo.onMessage((message) => {
			this.messageEventListener && this.messageEventListener(message);
		})
		userInfo.onStream((stream) => {
			this.sharedScreenEventListener && this.sharedScreenEventListener(stream);
		})
		this.joinEventListener && this.joinEventListener(userInfo);
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
	}
	removeStream(stream) {
		this.otherUsers.forEach(user => {
			user.removeStream(stream);
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
}

export default Group;