class Message {

	constructor(options) {
		this.type = null;
		this.data = null;
		this.sender = null;
		this.receiver = null;
		this.timestamp = new Date().toLocaleString();
		Object.assign(this, options);
	}

	setType(type) {
		this.type = type;
		return this;
	}

	setData(data) {
		this.data = data;
		return this;
	}

	setSender(sender) {
		this.sender = sender;
		return this;
	}

	setReceiver(receiver) {
		this.receiver = receiver;
		return this;
	}

	setTimestamp(timestamp) {
		this.timestamp = timestamp;
		return this;
	}

	getData() {
		return this.data;
	}

	getType() {
		return this.type;
	}

	getSender() {
		return this.sender;
	}

	getReceiver() {
		return this.receiver;
	}

	getTimestamp() {
		return this.timestamp;
	}

	clone() {
		return new Message(this);
	}
}

export default Message;