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
	}


	sendText(text) {
		let message = new Message();
		message.setType('message');
		message.setData(text);
		message.setSender(this.getId());

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