<script setup>
import {ref, nextTick} from 'vue'
import {ElMessage} from 'element-plus'
import Group from "../com/service/Group";
import Message from "../com/bo/Message";
import { Document, Download, Picture, VideoCamera, Monitor } from '@element-plus/icons-vue'

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
        type: 'system-welcome',
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
        type: 'system-welcome'
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
    const currentUser = group.getCurrentUser();
    if (!currentUser) {
        return;
    }
    const message = new Message({
        sender: currentUser.getId(),
        data: '系统检测到连接已断开，请手动刷新页面尝试获取用户',
        type: 'system'
    });
    onMessage(message)
})

const onMessage = (message) => {
    let isSelf = message.getSender() === group.getCurrentUser().getId();
    message.isSelf = isSelf;
    message.username = isSelf ? group.getCurrentUser().getName() : group.getUserInfo(message.getSender()).getName()
    showMessage(message)
    if (message.isSystem()) {
        return;
    }
    message.save();
}

const showMessage = (message) => {
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

const closeScreen = async () => {
    const id = group.getCurrentUser().getId();
    const streams = streamMap.value[id];
    if (!streams) {
        return;
    }
    const type = 'DisplayMedia'
    const stream = streams.find(stream => stream.label === type);
    onCloseStream(stream, group.getCurrentUser(), type)
    await group.removeStream(stream)
}

const handleKeydown = (e) => {
    if ((e.shiftKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        const start = e.target.selectionStart;
        const end = e.target.selectionEnd;
        const text = sendText.value;
        sendText.value = text.substring(0, start) + '\n' + text.substring(end);
        nextTick(() => {
            e.target.selectionStart = e.target.selectionEnd = start + 1;
        });
        return;
    }
    
    if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey) {
        e.preventDefault();
        if (sendText.value.trim()) {
            sendMessage();
        }
    }
}

const formatFileSize = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

group.onStream(onStream);
group.onCloseStream(onCloseStream);
group.onMessage(onMessage);

group.start().then(() => {
    ElMessage.success('建立连接成功')
}).catch((e) => {
    ElMessage.error('建立连接失败:' + e)
});
Message.list().then(data => {
    for (let i = data.length; i > 0; i--) {
        const message = data[i - 1];
        showMessage(message)
    }
})

</script>

<template>
    <div class="common-layout">
        <el-container class="chat-container">
            <el-aside width="280px" class="user-sidebar">
                <div class="sidebar-header">
                    <h3>在线用户 ({{ otherUsers.length + 1 }})</h3>
                </div>
                <div class="user-list">
                    <div class="current-user">
                        <div class="user-info" @click="modifyUsername">
                            <el-avatar :size="40">{{ currUser.name?.[0] }}</el-avatar>
                            <div class="user-detail">
                                <div class="username">{{ currUser.name }} <span class="user-tag">您</span></div>
                                <div class="user-id">ID: {{ currUser.id }}</div>
                            </div>
                        </div>
                        <div v-if="streamMap[currUser.id]" class="stream-container">
                            <div v-for="stream in streamMap[currUser.id]" :key="stream.id" class="stream-item">
                                <video autoplay muted controls :srcObject="stream" :id="stream.id"></video>
                                <el-button size="small" type="danger" plain
                                    @click="stream.label === 'UserMedia' ? closeCamera() : closeScreen()">
                                    关闭{{ stream.label === 'UserMedia' ? '摄像头' : '屏幕共享' }}
                                </el-button>
                            </div>
                        </div>
                    </div>
                    
                    <div v-for="user in otherUsers" :key="user.id" class="other-user">
                        <div class="user-info">
                            <el-avatar :size="40">{{ user.name?.[0] }}</el-avatar>
                            <div class="user-detail">
                                <div class="username">{{ user.name }}</div>
                                <div class="user-id">ID: {{ user.id }}</div>
                            </div>
                        </div>
                        <div v-if="streamMap[user.id]" class="stream-container">
                            <div v-for="stream in streamMap[user.id]" :key="stream.id" class="stream-item">
                                <video autoplay controls :srcObject="stream" :id="stream.id"></video>
                            </div>
                        </div>
                    </div>
                </div>
            </el-aside>

            <el-main class="chat-main">
                <div class="chat-box custom-scrollbar">
                    <div v-for="(message, index) in messages" :key="index" class="chat-detail" :class="{'system-message': message.isSystem()}">
                        <div v-if="message.type==='system'||message.type==='system-welcome'" class="chat-type-system text-center">
                            {{ message.data }}
                        </div>
                        <div v-else class="chat-type-user" :class="message.isSelf?'text-right':'text-left'">
                            <p class="chat-user">
                                {{ message.username }}
                                {{ message.timestamp }}
                            </p>
                            <div class="chat-data">
                                <template v-if="message.type === 'file'">
                                    <div class="file-content">
                                        <div class="file-header">
                                            <el-icon><Document /></el-icon>
                                            <div class="file-name" :title="message.data.name">{{ message.data.name }}</div>
                                        </div>
                                        <div class="file-info">
                                            <span class="file-size">{{ formatFileSize(message.data.size) }}</span>
                                            <template v-if="!message.isSelf">
                                                <template v-if="message.data.status === 'downloading'">
                                                    <div class="download-progress">
                                                        <span class="progress-text">{{ message.data.progress }}</span>
                                                        <el-button type="danger" link size="small" @click="downloadFileCancel(message)">
                                                            取消下载
                                                        </el-button>
                                                    </div>
                                                </template>
                                                <template v-else>
                                                    <el-button type="primary" link size="small" @click="downloadFile(message)">
                                                        <el-icon><Download /></el-icon>
                                                        下载
                                                    </el-button>
                                                </template>
                                            </template>
                                        </div>
                                    </div>
                                </template>
                                <p v-else-if="message.type==='text'">
                                    {{ message.data }}
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
                                <p v-else>
                                    {{ message }}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="toolbar">
                    <div class="button-group">
                        <el-tooltip content="发送文件" placement="top">
                            <el-upload ref="uploadFile"
                                       multiple
                                      :show-file-list="false" 
                                      :auto-upload="false" 
                                      :on-change="selectFile">
                                <el-button type="primary" plain>
                                    <el-icon><Document /></el-icon>
                                </el-button>
                            </el-upload>
                        </el-tooltip>

                        <el-tooltip content="发送图片" placement="top">
                            <el-upload ref="uploadImage"
                                       multiple
                                      :show-file-list="false" 
                                      accept="image/*"

                                      :auto-upload="false" 
                                      :on-change="selectImage">
                                <el-button type="primary" plain>
                                    <el-icon><Picture /></el-icon>
                                </el-button>
                            </el-upload>
                        </el-tooltip>

                        <el-tooltip content="语音视频通话" placement="top">
                            <el-button type="primary" plain @click="openCamera">
                                <el-icon><VideoCamera /></el-icon>
                            </el-button>
                        </el-tooltip>

                        <el-tooltip content="屏幕共享" placement="top">
                            <el-button type="primary" plain @click="sharedScreen">
                                <el-icon><Monitor /></el-icon>
                            </el-button>
                        </el-tooltip>
                    </div>
                </div>
                <div class="message-input">
                    <el-input v-model="sendText"
                              type="textarea"
                              :rows="3"
                              class="send-text"
                              resize="none"
                              placeholder="按 Enter 发送消息，Shift + Enter 或 Ctrl + Enter 换行..."
                              @keydown="handleKeydown">
                    </el-input>
                </div>
            </el-main>
        </el-container>
    </div>
</template>

<style scoped lang="scss">
.chat-container {
    height: 100vh;
    background-color: #f5f7fa;
}

.user-sidebar {
    background: white;
    border-right: 1px solid #e6e6e6;
    display: flex;
    flex-direction: column;
    
    .sidebar-header {
        padding: 16px;
        border-bottom: 1px solid #e6e6e6;
        
        h3 {
            margin: 0;
            font-size: 16px;
            color: #333;
        }
    }
    
    .user-list {
        flex: 1;
        overflow-y: auto;
        padding: 16px;
    }
}

.user-info {
    display: flex;
    align-items: center;
    padding: 8px;
    cursor: pointer;
    border-radius: 8px;
    
    &:hover {
        background-color: #f5f7fa;
    }
    
    .user-detail {
        margin-left: 12px;
        
        .username {
            font-size: 14px;
            font-weight: 500;
            
            .user-tag {
                background: #409EFF;
                color: white;
                padding: 2px 6px;
                border-radius: 4px;
                font-size: 12px;
                margin-left: 4px;
            }
        }
        
        .user-id {
            font-size: 12px;
            color: #999;
            margin-top: 2px;
        }
    }
}

.stream-container {
    margin-top: 8px;
    
    .stream-item {
        margin-bottom: 12px;
        
        video {
            width: 100%;
            border-radius: 8px;
            background: #000;
        }
        
        .el-button {
            margin-top: 8px;
            width: 100%;
        }
    }
}

.custom-scrollbar {
    &::-webkit-scrollbar {
        width: 6px;
    }
    
    &::-webkit-scrollbar-thumb {
        background: #c1c1c1;
        border-radius: 3px;
    }
    
    &::-webkit-scrollbar-track {
        background: #f1f1f1;
    }
}

.chat-main {
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 20px;
}

.chat-box {
    flex: 1;
    overflow-y: auto;
    padding: 20px;
    background-color: #f5f7fa;
}

.chat-type-user {
    margin: 10px 0;
    display: flex;
    flex-direction: column;
    
    &.text-right {
        align-items: flex-end;

        .chat-data {
            background-color: #e3f2fd;
            color: #1976d2;
        }
    }

    &.text-left {
        align-items: flex-start;

        .chat-data {
            background-color: #f5f5f5;
            color: #424242;
        }
    }
}

.chat-data {
    padding: 8px 12px;
    border-radius: 8px;
    max-width: 80%;
    word-break: break-all;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}

.chat-image {
    img {
        border-radius: 8px;
        box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
    }
}

.toolbar {
    padding: 12px;
    border-top: 1px solid #e6e6e6;
    background: white;
    
    .button-group {
        display: flex;
        gap: 8px;
    }
}

.message-input {
    padding: 12px;
    background: white;
    
    .send-text {
        width: 100%;
    }
}

.chat-type-system {
    margin: 10px 0;
    padding: 5px 10px;
    background-color: #f8f9fa;
    border-radius: 4px;
    font-size: 13px;
}

.file-download, .file-download-cancel {
    &:hover {
        text-decoration: underline;
    }
}

.text-left {
    text-align: left;
}

.text-right {
    text-align: right;
}

.text-center {
    text-align: center;
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
