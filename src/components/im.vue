<script setup>
import {ref, nextTick} from 'vue'
import {ElMessage} from 'element-plus'
import Group from "../com/service/Group";
import Message from "../com/bo/Message";

const currUser = ref({});
const group = new Group('im');
const otherUsers = ref([]);
const messages = ref([]);
const sendText = ref('');
const uploadFile = ref({});
const uploadImage = ref({});
const streamMap = ref({});

group.onConnect((userInfo) => {
    currUser.value = userInfo;
})
group.onJoin((userInfo) => {
    otherUsers.value.push(userInfo);
    const message = new Message({
        sender: group.getCurrentUser().getId(),
        data: userInfo.name + ' 进入了房间',
        type: 'system'
    });
    onMessage(message)
})
group.onLeave((userInfo) => {
    const index = otherUsers.value.findIndex(u => u.id === userInfo.id);
    if (index !== -1) {
        otherUsers.value.splice(index, 1);
    }
    const message = new Message({
        sender: group.getCurrentUser().getId(),
        data: userInfo.name + ' 离开了房间',
        type: 'system'
    });
    onMessage(message)

    if (otherUsers.value.length === 0) {
        const message = new Message({
            sender: group.getCurrentUser().getId(),
            data: '系统检测到房间内无其他用户，请手动刷新页面尝试获取用户',
            type: 'system'
        });
        onMessage(message)
    }
})
group.onClose(() => {
    ElMessage.error('连接已断开')
    const message = new Message({
        sender: group.getCurrentUser().getId(),
        data: '系统检测到连接已断开，请手动刷新页面尝试获取用户',
        type: 'system'
    });
    onMessage(message)
})

const onMessage = (message) => {
    let isSelf = message.getSender() === group.getCurrentUser().getId();
    message.isSelf = isSelf;
    message.username = isSelf ? group.getCurrentUser().getName() : group.getUserInfo(message.getSender()).getName()
    messages.value.push(message);

    const delay = message.getType() === 'image' ? setTimeout : nextTick;
    delay(() => {
        let charBox = document.getElementsByClassName('chat-box')[0];
        charBox.scrollTo({
            top: charBox.scrollHeight,
            behavior: 'smooth',
        });
        // window.focus()
    }, message.getType() === 'image' ? 10 : undefined)
}

const onStream = (stream, userInfo, type) => {
    stream.label = type;
    const id = userInfo.getId();
    let map = streamMap.value;
    const streams = map[id];
    if (!streams) {
        map[id] = [];
    }
    map[id].push(stream);
}

const onCloseStream = (stream, userInfo, type) => {
    const id = userInfo.getId();
    let map = streamMap.value;
    const streams = map[id];
    if (!streams) {
        return;
    }
    const index = streams.findIndex(s => s === stream);
    if (index !== -1) {
        streams.splice(index, 1);
    }
    if (streams.length === 0) {
        delete map[id];
    }
    if (userInfo === group.getCurrentUser()) {
        stream.getTracks().forEach(track => track.stop())
    }
}

const sendMessage = () => {
    const message = new Message({sender: group.getCurrentUser().getId(), data: sendText.value, type: 'text'});
    onMessage(message)
    group.sendText(sendText.value)
    sendText.value = ''
}
const selectFile = (select) => {
    uploadFile.value.clearFiles()
    const message = new Message({
        sender: group.getCurrentUser().getId(),
        data: {name: select.raw.name, size: select.raw.size},
        type: 'file'
    });
    onMessage(message)
    group.sendFile(select.raw)
}
const downloadFile = (message) => {
    let sender = message.getSender();
    const userInfo = group.getUserInfo(sender);
    if (!userInfo) {
        ElMessage.error('无法下载文件，用户不在线')
        return;
    }
    if (!message.data.onClose) {
        message.data.onClose = () => {
            if (message.data.status !== 'downloading') {
                return;
            }
            message.data.progress = '下载失败，用户离线';
            message.data.status = 'error';
            ElMessage.error(message.getData().name + '下载失败，用户离线')
        }
        userInfo.onClose(message.data.onClose)
    }

    let begin = Date.now();
    let beginChunkSize = 0;
    let networkSpeed = '0KB/s';
    const promise = userInfo.download(message.getData(), (chunkSize, totalSize) => {
        const now = Date.now();
        if (now - begin > 1000) {
            begin = now;
            const kb = (chunkSize - beginChunkSize) / 1024;
            beginChunkSize = chunkSize;
            if (kb > 1024) {
                networkSpeed = (kb / 1024).toFixed(2) + 'MB/s';
            } else {
                networkSpeed = kb.toFixed(2) + 'KB/s';
            }
        }
        const number = (chunkSize / 1024 / 1024).toFixed(2);
        const percent = (chunkSize / totalSize * 100).toFixed(2);
        message.data.progress = number + 'MB' + '(' + percent + '%) - ' + networkSpeed;
        message.data.status = 'downloading';
    });
    promise.then(() => {
        message.data.progress = '下载完成 - ' + networkSpeed;
        message.data.status = 'success';
        ElMessage.success(message.getData().name + '下载成功')
    }).catch((e) => {
        ElMessage.error(e)
    })
}

const selectImage = (select) => {
    uploadImage.value.clearFiles()
    const reader = new FileReader();
    reader.onloadend = function () {
        const blob = new Blob([reader.result], {type: 'image/jpeg'}); // 可以根据图片类型调整 MIME 类型
        const url = URL.createObjectURL(blob);
        const message = new Message({
            sender: group.getCurrentUser().getId(),
            data: url,
            type: 'image',
        });
        onMessage(message)
    };
    reader.readAsArrayBuffer(select.raw);
    group.sendImage(select.raw)
}

const downloadFileCancel = async (message) => {
    let sender = message.getSender();
    const userInfo = group.getUserInfo(sender);
    if (!userInfo) {
        ElMessage.error('无法取消下载，用户不在线')
        return;
    }
    await userInfo.downloadCancel(message.getData())
    delete message.data.onClose;
    message.data.progress = '';
    message.data.status = 'cancel';
}

const modifyUsername = () => {
    const username = prompt(' 修改昵称 ', currUser.value.name);
    if (username === null || username === undefined) {
        return;
    }
    if (username === '') {
        localStorage.removeItem('username')
    } else {
        localStorage.setItem('username', username)
        currUser.value.name = username
    }
    ElMessage.success('昵称修改成功，请刷新页面')
}

const openCamera = async () => {
    let stream = await navigator.mediaDevices.getUserMedia({video: true, audio: true});
    const type = 'UserMedia'
    onStream(stream, group.getCurrentUser(), type)
    await group.addStream(stream, type)
}

const closeCamera = async () => {
    const id = group.getCurrentUser().getId();
    const streams = streamMap.value[id];
    if (!streams) {
        return;
    }
    const type = 'UserMedia'
    const stream = streams.find(stream => stream.label === type);
    onCloseStream(stream, group.getCurrentUser(), type)
    await group.removeStream(stream)
}

const sharedScreen = async () => {
    let stream = await navigator.mediaDevices.getDisplayMedia({video: true, audio: true});
    const type = 'DisplayMedia'
    onStream(stream, group.getCurrentUser(), type)
    await group.addStream(stream, type)
}

const closeScreen = () => {

}

group.onStream(onStream);
group.onCloseStream(onCloseStream);
group.onMessage(onMessage);

group.start().then(() => {
    ElMessage.success('建立连接成功')
}).catch((e) => {
    ElMessage.error('建立连接失败:' + e)
});
</script>

<template>
    <div class="common-layout">
        <el-container>
            <el-main>
                <div class="chat-box">
                    <div v-for="(message, index) in messages" :key="index" class="chat-detail">
                        <div v-if="message.type==='system'" class="chat-type-system text-center">
                            {{ message.data }}
                        </div>
                        <div v-else class="chat-type-user" :class="message.isSelf?'text-right':'text-left'">
                            <p class="chat-user">
                                {{ message.username }}
                                {{ message.timestamp }}
                            </p>
                            <p v-if="message.type==='text'" class="chat-data">
                                {{ message.data }}
                            </p>
                            <p v-else-if="message.type==='file'" class="chat-data">
                                <span class="file-name">{{ message.data.name }}</span>
                                <span class="file-size">
                                {{ (message.data.size / 1024 / 1024).toFixed(2) }}MB
                            </span>
                                <span v-if="!message.isSelf">
                                <span class="file-download"
                                      @click="downloadFile(message)">下载</span>
                                <span class="file-download-process">{{ message.data.progress }}</span>
                                <span v-if="message.data.status==='downloading'" class="file-download-cancel"
                                      @click="downloadFileCancel(message)">取消下载</span>
                            </span>
                            </p>
                            <p v-else-if="message.type==='image'" class="chat-image">
                                <el-image
                                    style="width: 400px; height: auto"
                                    :src="message.data"
                                    :hide-on-click-modal="true"
                                    :preview-src-list="[message.data]"
                                    fit="cover"
                                />
                            </p>
                            <p v-else class="chat-data">
                                {{ message }}
                            </p>
                        </div>
                    </div>
                </div>
                <div>
                    <el-upload
                        ref="uploadFile"
                        :show-file-list="false"
                        multiple
                        :auto-upload="false"
                        :on-change="selectFile"
                        style="display: inline"
                    >
                        <el-button>文件</el-button>
                    </el-upload>

                    <el-upload
                        ref="uploadImage"
                        :show-file-list="false"
                        multiple
                        :auto-upload="false"
                        accept="image/*"
                        :on-change="selectImage"
                        style="display: inline"
                    >
                        <el-button>图片</el-button>
                    </el-upload>
                    <el-button @click="openCamera">语音视频</el-button>
                    <el-button @click="sharedScreen">屏幕共享</el-button>
                </div>
                <div>
                    <el-input v-model="sendText" class="send-text" @keydown.enter="sendMessage"></el-input>
                    <el-button @click="sendMessage">发送</el-button>
                </div>
            </el-main>
            <el-aside width="300px">
                <div class="chat-user-list">
                    <div>
                        在线人数:{{ otherUsers.length + 1 }}
                    </div>
                    <div>
                        <div style="cursor: pointer;color: blue;" @click="modifyUsername">{{
                                currUser.name
                            }}({{ currUser.id }})(您)
                        </div>
                        <video v-if="streamMap[currUser.id]" v-for="(stream, index) in streamMap[currUser.id]"
                               autoplay muted :srcObject="stream" :id="stream.id"></video>
                        <button v-if="streamMap[currUser.id]&&streamMap[currUser.id].some(s=>s.label==='UserMedia')"
                                @click="closeCamera">关闭摄像头
                        </button>
                    </div>
                    <div v-for="(user, index) in otherUsers">
                        <div>{{ user.name }}({{ user.id }})</div>
                        <div v-if="streamMap[user.id]" v-for="(stream, index) in streamMap[user.id]">
                            <video autoplay muted :srcObject="stream" :id="stream.id"></video>
                        </div>
                    </div>
                </div>
            </el-aside>
        </el-container>
    </div>
</template>

<style scoped lang="scss">


.text-left {
    text-align: left;
}

.text-right {
    text-align: right;
}

.text-center {
    text-align: center;
}

.chat-box {
    overflow: auto;
    overflow-anchor: none;
    scroll-behavior: smooth;
    height: 800px;
    border: 1px solid #00000026;
}

.send-text {
    width: 100%
}

.chat-box .chat-type-user {
    padding: 5px;
}

.chat-box .chat-type-system {
    color: #666666;
    font-size: 12px;
    font-family: "Helvetica Neue", Helvetica, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "微软雅黑", Arial, sans-serif;
}

.chat-box .chat-type-user:nth-of-type(odd) {
    background-color: #f2f2f2;
}

.chat-box .chat-type-user:nth-of-type(even) {
    background-color: #ffffff;
}

.chat-box .chat-type-user:hover {
    background-color: #cccccc;
    //cursor: pointer;
}

.chat-box .chat-user {
    font-size: 14px;
    color: #999999;
}

.chat-box .chat-data {
    font-size: 16px;
    color: #333333;
}

.chat-box .file-name {
    color: #0000ff;
}

.chat-box .file-size {
    color: #0000ff;
    padding: 0 0 0 8px;
}

.chat-box .file-download {
    color: #0000ff;
    cursor: pointer;
    padding: 0 0 0 8px;
}

.chat-box .file-download-process {
    color: #808080;
    padding: 0 0 0 8px;
}

.chat-box .file-download-cancel {
    color: #ff0000;
    cursor: pointer;
    padding: 0 0 0 8px;
}

.chat-user-list video {
    width: 100%;
}
</style>
