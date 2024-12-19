import Message from "./Message";
import adapter from 'webrtc-adapter';
import CommonUtil from "../util/CommonUtil";

class UserInfo {

    static fileChannelName = 'sendFileChannel';
    static dataChannelName = 'sendDataChannel';

    constructor(options) {
        this.dispose();
        Object.assign(this, options);
    }

    dispose() {
        if (this._dataChannel) {
            this._dataChannel.close();
        }
        if (this._fileChannel) {
            this._fileChannel.close();
        }
        if (this._connect) {
            this._connect.close();
        }
        this.id = null;
        this.name = null;
        this._connect = null;
        this._dataChannel = null;
        this._fileChannel = null;
        this._eventListener = {
            streams: [], removeStreams: [], messages: [], connect: [], close: []
        };
        this._remoteStreams = [];
        this._streamType = {};
        this._localStream = [];
        this._socket = null;
        this._connectComplete = false;
        this._sendFiles = {};
        this._downFile = null;
    }

    onMessage(listener) {
        this._eventListener.messages.push(listener);
        return this;
    }

    onConnect(listener) {
        this._eventListener.connect.push(listener);
        return this;
    }

    onClose(listener) {
        this._eventListener.close.push(listener);
        return this;
    }

    onStream(listener) {
        this._eventListener.streams.push(listener);
        return this;
    }

    async init() {
        const message = new Message();
        message.setType('join');
        message.setData(this);
        await this.sendSignalingMessage(message);
    }

    async connect(userInfo) {
        let connect = this.createConnection();
        let dataChannel = connect.createDataChannel(UserInfo.dataChannelName, null);
        this.setDataChannel(dataChannel);
        this.setConnect(connect);

        let message = new Message();
        message.setType('receive');
        message.setData(userInfo);
        message.setReceiver(this.getId());
        await this.sendSignalingMessage(message);
        return this;
    }

    async receive() {
        let connect = this.createConnection();
        let rtcDataChannel = connect.createDataChannel(UserInfo.dataChannelName, null);
        this.setDataChannel(rtcDataChannel);
        this.setConnect(connect);
        await this.offer();
    }

    async rtc(message) {
        const data = message.getData();
        if (data.type === 'offer') {
            return this.answer(data)
        } else if (data.type === 'answer') {
            return this.answerFinish(data)
        } else if (data.type === 'candidate') {
            return this.iceCandidate(data)
        }
        throw 'unknown rtc type'
    }

    async offer() {
        const connect = this.getConnect();
        const sessionDescription = await connect.createOffer();
        await connect.setLocalDescription(sessionDescription);
        let message = new Message();
        message.setType('rtc');
        message.setData(sessionDescription);
        message.setReceiver(this.getId());
        await this.sendSignalingMessage(message);
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
        await this.sendSignalingMessage(message);
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
            await this.sendMessage(message);
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
        // const config = {
        //     "iceServers": [{
        //         "url": "stun:" + location.hostname
        //     }, {
        //         "url": "turn:" + location.hostname, username: "olddriver", credential: "olddriver"
        //     }]
        // }
        const config = {
            // iceServers: [
            //     {urls: "stun:stun.l.google.com:19302"}
            // ]
        };
        const connect = new RTCPeerConnection(config);
        connect.onicecandidate = async (event) => {
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
                await that.sendSignalingMessage(message);
            } else {
                // console.log('End of candidates.');
            }
        }
        connect.ondatachannel = (event) => {
            const receiveChannel = event.channel;
            receiveChannel.onmessage = async (event) => {
                const channel = event.currentTarget;
                if (channel.label === UserInfo.fileChannelName) {
                    that.receiveFile(event.data)
                } else {
                    const message = new Message(JSON.parse(event.data));
                    message.setSender(that.getId())
                    message.setTimestamp(new Date().toLocaleString())
                    if (message.getType() === 'rtc') {
                        await that.rtc(message);
                    } else if (message.getType() === 'stream') {
                        const data = message.getData();
                        that._streamType[data.id] = data.type;
                    } else if (message.getType() === 'download') {
                        await that.transferFile(message);
                    } else {
                        that._eventListener.messages.forEach(listener => {
                            listener(message.clone());
                        });
                    }
                }


            }
        }
        connect.onconnectionstatechange = (event) => {
            switch (connect.connectionState) {
                case 'closed':
                case 'disconnected':
                case 'failed':
                    that._eventListener.close.forEach(listener => {
                        listener(connect.connectionState);
                    });
                    that.dispose();
                    break;
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

    async sendSignalingMessage(message) {
        if (this._connectComplete && await this.sendMessage(message)) {
            return this;
        }
        this._socket.emit(message);
        return this;
    }

    sendText(text) {
        let message = new Message();
        message.setType('text');
        message.setData(text);
        return this.sendMessage(message);
    }

    async sendMessage(message) {
        message.setReceiver(this.getId());
        const data = JSON.stringify(message);
        const dataChannel = this.getDataChannel();
        return this.sendData(dataChannel, data);
    }

    async sendData(dataChannel, data) {
        if (!(dataChannel && dataChannel.readyState === 'open')) {
            return false;
        }
        if (dataChannel.bufferedAmount > dataChannel.bufferedAmountLowThreshold) {
            const promise = new Promise((resolve, reject) => {
                dataChannel.onbufferedamountlow = () => {
                    dataChannel.onbufferedamountlow = null;
                    dataChannel.send(data);
                    resolve();
                };
            });
            await promise;
            return true;
        } else {
            dataChannel.send(data);
        }
        return true;
    }

    sendFile(file) {
        const message = new Message();
        message.setType('file');
        message.setData({uid: file.uid, name: file.name, size: file.size, type: file.type});
        this._sendFiles[file.uid] = file;
        return this.sendMessage(message);
    }

    download(file, process) {
        return new Promise(async (resolve, reject) => {
            if (this._downFile) {
                reject('当前正在下载文件，请等待下载完成或取消下载')
                return;
            }
            const fileChannel = this.getFileChannel();
            if (!fileChannel) {
                const dataChannel = this.getConnect().createDataChannel(UserInfo.fileChannelName, null);
                this.setFileChannel(dataChannel);
            }
            const message = new Message();
            message.setType('download');
            const data = {uid: file.uid, name: file.name, size: file.size, type: file.type};
            message.setData(data);
            const success = await this.sendMessage(message);
            if (!success) {
                reject('文件下载失败，通道已关闭')
                return;
            }
            data.listener = process;
            data.resolve = resolve;
            data.reject = reject;
            this._downFile = data;
        })
    }

    async transferFile(message) {
        const that = this;
        const data = message.getData();
        const file = this._sendFiles[data.uid];
        const chunkSize = 16 * 1024;
        let fileChannel = this.getFileChannel();
        if (!fileChannel) {
            fileChannel = this.getConnect().createDataChannel(UserInfo.fileChannelName, null);
            this.setFileChannel(fileChannel);
        }
        const sendNextChunk = (offset) => {
            const reader = new FileReader();
            reader.onload = async () => {
                const success = await that.sendData(fileChannel, reader.result);
                if (!success) {
                    return;
                }
                offset += chunkSize;
                if (offset < file.size) {
                    sendNextChunk(offset);
                }
            };
            const slice = file.slice(offset, offset + chunkSize);
            reader.readAsArrayBuffer(slice);
        }
        sendNextChunk(0);
    }

    receiveFile(data) {
        const totalSize = this._downFile.size;
        const receivedChunks = this._downFile.receivedChunks = this._downFile.receivedChunks || [];
        const chunkSize = this._downFile.receivedSize = (this._downFile.receivedSize || 0) + data.byteLength;
        receivedChunks.push(data);
        if (chunkSize === totalSize) {
            const fileArrayBuffer = this.concatenateArrayBuffers(receivedChunks);
            const blob = new Blob([fileArrayBuffer]);
            const fileURL = URL.createObjectURL(blob);

            const a = document.createElement('a');
            a.href = fileURL;
            a.download = this._downFile.name;
            a.click();

            URL.revokeObjectURL(fileURL);

            this._downFile.resolve();
            this._downFile = null;

        } else {
            this._downFile.listener && this._downFile.listener(chunkSize, totalSize);
        }
    }

    concatenateArrayBuffers(arrayBuffers) {
        const totalLength = arrayBuffers.reduce((sum, buffer) => sum + buffer.byteLength, 0);
        const mergedArrayBuffer = new ArrayBuffer(totalLength);
        const mergedView = new Uint8Array(mergedArrayBuffer);

        let offset = 0;
        arrayBuffers.forEach(buffer => {
            mergedView.set(new Uint8Array(buffer), offset);
            offset += buffer.byteLength;
        });

        return mergedArrayBuffer;
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

    setFileChannel(fileChannel) {
        this._fileChannel = fileChannel;
        return this;
    }

    getFileChannel() {
        return this._fileChannel;
    }

    setSocket(socket) {
        this._socket = socket;
        return this;
    }
}

export default UserInfo;