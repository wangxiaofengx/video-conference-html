import Message from "../bo/Message";
import UserInfo from "../bo/UserInfo";

class Group {
	constructor(channel) {
		this.channel = channel;
		this.currUser = null;
		this._socket = null;
		this.otherUsers = [];
		this._eventListener = {
			connect: [],
			join: [],
			leave: [],
			message: [],
			stream: [],
		};
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
			that._eventListener.connect.forEach(event => {
				event(userInfo);
			});
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
				this._eventListener.leave.forEach(event => {
					event(userInfo);
				});
			}
		})
	}

	onConnect(event) {
		this._eventListener.connect.push(event);
		return this;
	}

	onJoin(event) {
		this._eventListener.join.push(event);
		return this;
	}

	onLeave(event) {
		this._eventListener.leave.push(event);
		return this;
	}

	onMessage(event) {
		this._eventListener.message.push(event);
		return this;
	}

	onStream(event) {
		this._eventListener.stream.push(event);
		return this;
	}

	addUser(userInfo) {
		this.otherUsers.push(userInfo);
		userInfo.onMessage((message) => {
			this._eventListener.message.forEach(event => {
				event(message, userInfo);
			});
		})
		userInfo.onConnect(async () => {
			for (const stream of this.currUser.getLocalStreams()) {
				await userInfo.addStream(stream);
			}
			this._eventListener.join.forEach(event => {
				event(userInfo);
			});
		})
		userInfo.onStream((stream) => {
			this._eventListener.stream.forEach(event => {
				event(stream, userInfo);
			});
		})
	}

	sendText(text) {
		let message = new Message();
		message.setType('text');
		message.setData(text);
		this.otherUsers.forEach(user => {
			user.sendText(text);
		});
	}

	async addStream(stream) {
		for (const user of this.otherUsers) {
			await user.addStream(stream);
		}
		this.currUser.addLocalStream(stream);
	}

	async removeStream(stream) {
		for (const user of this.otherUsers) {
			await user.removeStream(stream);
		}
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