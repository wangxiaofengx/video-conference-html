import Message from "./Message";
import adapter from 'webrtc-adapter';
import CommonUtil from "../util/CommonUtil";

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
            streams: [], removeStreams: [], messages: [], connect: [],
        };
        this._remoteStreams = [];
        this._streamType = {};
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

    async receive() {
        let connect = this.createConnection();
        let rtcDataChannel = this.createDataChannel(connect);
        this.setDataChannel(rtcDataChannel);
        this.setConnect(connect);
        await this.offer();
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

    addLocalStream(stream, type) {
        if (!this._localStream.some(s => s.id === stream.id)) {
            this._localStream.push({stream, type});
        }
        return this;
    }

    removeLocalStream(stream) {
        const index = this._localStream.findIndex(s => s.stream.id === stream.id);
        if (index !== -1) {
            this._localStream.splice(index, 1);
        }
        return this;
    }

    getLocalStreams() {
        return this._localStream;
    }

    async addStream(stream, type) {
        if (type) {
            const message = new Message();
            message.setType('stream');
            message.setData({id: stream.id, type: type});
            this.sendMessage(message);
        }

        const connect = this.getConnect();
        stream.getTracks().forEach(track => {
            const sender = connect.getSenders().find(s => s.track === track);
            if (!sender) {
                connect.addTrack(track, stream);
            }
        })
        await this.offer()
    }

    async removeStream(stream) {
        const connect = this.getConnect();
        stream.getTracks().forEach(track => {
            const sender = connect.getSenders().find(s => s.track === track);
            if (sender) {
                connect.removeTrack(sender);
            }
        })
        await this.offer()
    }

    async removeTrack() {
        const connect = this.getConnect();
        for (let i = 0; i < arguments.length; i++) {
            const track = arguments[i];
            const sender = connect.getSenders().find(s => s.track === track);
            if (sender) {
                connect.removeTrack(sender);
            }
        }
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
                stream.addEventListener('removetrack', (e) => {
                    const tracks = stream.getTracks();
                    if (tracks.length === 0) {
                        delete that._streamType[stream.id];
                    }
                })
                that._eventListener.streams.forEach(listener => {
                    listener(stream, that._streamType[stream.id]);
                });
            });
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
                if (message.getType() === 'rtc') {
                    that.rtc(message);
                } else if (message.getType() === 'stream') {
                    const data = message.getData();
                    that._streamType[data.id] = data.type;
                } else if (message.getType() === 'text') {
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