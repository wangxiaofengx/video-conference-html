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
const uploadImage = ref({})

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
    userInfo.onClose(() => {
        message.data.progress = '下载失败，用户离线';
        message.data.status = 'error';
        ElMessage.error(message.getData().name + '下载失败，用户离线')
    })
    const promise = userInfo.download(message.getData(), (chunkSize, totalSize) => {
        const number = (chunkSize / 1024 / 1024).toFixed(2);
        const percent = (chunkSize / totalSize * 100).toFixed(2);
        message.data.progress = number + 'MB' + '(' + percent + '%)';
        message.data.status = 'downloading';
    });
    promise.then(() => {
        message.data.progress = '下载完成';
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
        const message = new Message({
            sender: group.getCurrentUser().getId(),
            data: reader.result,
            type: 'image',
        });
        onMessage(message)
    };
    reader.readAsDataURL(select.raw);

}

const downloadFileCancel = (message) => {
    let sender = message.getSender();
    const userInfo = group.getUserInfo(sender);
    if (!userInfo) {

    }
}

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
                                    <!--                                <span v-if="message.data.status==='downloading'"-->
                                    <!--                                      class="file-download-cancel">取消下载</span>-->
                            </span>
                            </p>
                            <p v-else-if="message.type==='image'" class="chat-image">
                                <el-image
                                    style="width: 220px; height: auto"
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
                        :on-change="selectImage"
                        style="display: inline"
                        list-type="picture"
                    >
                        <el-button>图片</el-button>
                    </el-upload>
                </div>
                <div>
                    <el-input v-model="sendText" class="send-text" @keydown.enter="sendMessage"></el-input>
                    <el-button @click="sendMessage">发送</el-button>
                </div>
            </el-main>
            <el-aside width="150px">
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
    height: 500px;
    border: 1px solid #000;
}

.send-text {
    width: 100%
}

.chat-box .chat-type-user {
    padding: 5px;
}

.chat-box .chat-type-system {
    color: #666666;
    font-size: 11px;
    font-family: "Helvetica Neue", Helvetica, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "微软雅黑", Arial, sans-serif;
}

.chat-box .chat-type-user:nth-of-type(odd) {
    background-color: #f2f2f2;
}

.chat-box .chat-type-user:nth-of-type(even) {
    background-color: #ffffff;
}

.chat-box .chat-type-user:hover {
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

.chat-box .file-download-process {
    color: #808080;
    padding: 0 0 0 8px;
}

//.chat-box .chat-image img {
//    width: 400px;
//    height: auto;
//    transition: transform 0.3s ease;
//}
//.chat-box .chat-image img:hover {
//    transform: scale(1.5); /* 放大1.5倍 */
//}
</style>
