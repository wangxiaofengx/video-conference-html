<script setup>
import {ref, nextTick} from 'vue'
import Group from "../com/service/Group";
import Message from "@/com/bo/Message";

const currUser = ref({});
const group = new Group('online');
const otherUsers = ref([]);
const messages = ref([]);
const sendText = ref('');
const uploadFile=ref({});

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

const onMessage = (message, userInfo) => {
    const data = {
        userInfo: userInfo,
        text: message.getData(),
        type: message.getType(),
        time: new Date().toLocaleString()
    }
    messages.value.push(data);
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
    onMessage(new Message({data: sendText.value}), currUser.value)
    group.sendText(sendText.value)
    sendText.value = ''
}
const selectFile = (select) => {
    uploadFile.value.clearFiles()
    console.log(select);
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
                         :style="message.userInfo===currUser?'text-align: right;':'text-align: left;'" :key="index">
                        <p>
                            {{ message.userInfo.name }} {{ message.time }}
                        </p>
                        <p>
                            {{ message.text }}
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
                    {{ currUser.name }}(您)
                    <div v-for="(user, index) in otherUsers">{{ user.name }}</div>
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
</style>
