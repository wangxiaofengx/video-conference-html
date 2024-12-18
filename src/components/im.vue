<script setup>
import {ref, nextTick} from 'vue'
import {ElMessage} from 'element-plus'
import Group from "../com/service/Group";
import Message from "../com/bo/Message";

const currUser = ref({});
const group = new Group('online');
const otherUsers = ref([]);
const messages = ref([]);
const sendText = ref('');
const uploadFile = ref({});

group.onConnect((userInfo) => {
    currUser.value = userInfo;
})
group.onJoin((userInfo) => {
    otherUsers.value.push(userInfo);
})
group.onLeave((userInfo) => {
    const index = otherUsers.value.findIndex(u => u.id === userInfo.id);
    if (index !== -1) {
        otherUsers.value.splice(index, 1);
    }
})

const onMessage = (message) => {
    let isSelf = message.getSender() === group.getCurrentUser().getId();
    message.isSelf = isSelf;
    message.username = isSelf ? group.getCurrentUser().getName() : group.getUserInfo(message.getSender()).getName()
    messages.value.push(message);
    nextTick(() => {
        let charBox = document.getElementsByClassName('chat-box')[0];
        charBox.scrollTo({
            top: charBox.scrollHeight,
            behavior: 'smooth',
        });
        // window.focus()
    })
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
    const promise = userInfo.download(message.getData(), (chunkSize, totalSize) => {

    });
    promise.then(() => {
        ElMessage({
            message: message.getData().name + '下载成功',
            type: 'success',
        })
    }).catch((e) => {
        ElMessage.error(e)
    })
}

group.onMessage(onMessage);

group.start()
</script>

<template>
    <div class="common-layout">
        <el-container>
            <el-main>
                <div class="chat-box">
                    <div v-for="(message, index) in messages"
                         :style="message.isSelf?'text-align: right;':'text-align: left;'"
                         :key="index">
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
                                {{ Math.round(message.data.size / 1024 / 1024 * 100) / 100 }}MB
                            </span>
                            <span class="file-download" v-if="!message.isSelf"
                                  @click="downloadFile(message)">下载</span>
                        </p>
                        <p v-else class="chat-data">
                            {{ message }}
                        </p>
                    </div>
                </div>
                <div>
                    <el-button>表情</el-button>
                    <el-upload
                        ref="uploadFile"
                        :show-file-list="false"
                        multiple
                        :auto-upload="false"
                        :on-change="selectFile"
                    >
                        <el-button>文件</el-button>
                    </el-upload>

                    <el-button>图片</el-button>
                </div>
                <div>
                    <el-input v-model="sendText" class="send-text" @keydown.enter="sendMessage"></el-input>
                    <el-button @click="sendMessage">发送</el-button>
                </div>
            </el-main>
            <el-aside width="200px">
                <div>
                    在线人数:{{ otherUsers.length + 1 }}
                </div>
                <div>
                    {{ currUser.name }}({{ currUser.id }})(您)
                    <div v-for="(user, index) in otherUsers">{{ user.name }}({{ user.id }})</div>
                </div>
            </el-aside>
        </el-container>
    </div>
</template>

<style scoped lang="scss">

.chat-box {
    overflow: auto;
    overflow-anchor: none;
    scroll-behavior: smooth;
    height: 400px;
    border: 1px solid #000;
}

.send-text {
    width: 100%
}

.chat-box div {
    padding: 5px;
}

.chat-box div:nth-child(odd) {
    background-color: #f2f2f2;
}

.chat-box div:nth-child(even) {
    background-color: #ffffff;
}

.chat-box div:hover {
    background-color: #d1c4e9;
    //cursor: pointer;
}

.chat-box .chat-user {
    font-size: 12px;
    color: #999999;
}

.chat-box .chat-data {
    font-size: 14px;
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
</style>
