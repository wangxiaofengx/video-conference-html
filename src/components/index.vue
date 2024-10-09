<script setup>
import {ref, nextTick} from 'vue'
import Group from "../com/service/Group";

const currUser = ref(null);
const group = new Group('online');
const otherUsers = ref([]);
const messages = ref([]);
const sendText = ref('');
const streams = ref([]);
const videos = ref(null);

const sendMessage = (text) => {
    messages.value.push(sendText.value);
    group.sendText(sendText.value)
    sendText.value = ''
}
let displayMediaStream = null;
const sharedScreen = async () => {
    displayMediaStream = await navigator.mediaDevices.getDisplayMedia({video: true, audio: true});
    await group.addStream(displayMediaStream)
    displayMediaStream.getVideoTracks()[0].addEventListener('ended', () => {
        console.log('The user has ended sharing the screen');
    });
}
const closeScreen = async () => {
    await group.removeStream(displayMediaStream)
    displayMediaStream.getTracks().forEach(track => {
        track.stop();
    })
    displayMediaStream = null;
}
let userMediaStream = null;
const openCamera = async () => {
    if (userMediaStream != null && userMediaStream.getTracks().some(track => track.kind === 'video')) {
        console.error('Camera is already open')
        return;
    }
    let stream = await navigator.mediaDevices.getUserMedia({video: true});
    console.log(stream.getTracks())
    if (!userMediaStream) {
        userMediaStream = stream;
    } else {
        const mediaStreamTrack = stream.getTracks().find(track => {
            return track.kind === 'video';
        });
        userMediaStream.addTrack(mediaStreamTrack);
    }
    await group.addStream(userMediaStream)
}
const closeCamera = async () => {
    const mediaStreamTrack = userMediaStream.getTracks().find(track => {
        return track.kind == 'video';
    });
    mediaStreamTrack.stop();
    await group.removeTrack(mediaStreamTrack)
    userMediaStream.removeTrack(mediaStreamTrack)
}
const openAudio = async () => {
    if (userMediaStream != null && userMediaStream.getTracks().some(track => track.kind === 'audio')) {
        console.error('audio is already open')
        return;
    }
    let stream = await navigator.mediaDevices.getUserMedia({audio: true});
    if (!userMediaStream) {
        userMediaStream = stream;
    } else {
        const mediaStreamTrack = stream.getTracks().find(track => {
            return track.kind === 'audio';
        });
        userMediaStream.addTrack(mediaStreamTrack);
    }
    await group.addStream(userMediaStream)
}
const closeAudio = async () => {
    const mediaStreamTrack = userMediaStream.getTracks().find(track => {
        return track.kind == 'audio';
    });
    mediaStreamTrack.stop();
    await group.removeTrack(mediaStreamTrack)
    userMediaStream.removeTrack(mediaStreamTrack)
}

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
        let number;
        while ((number = streams.value.findIndex(s => s.userInfo.id === userInfo.id)) !== -1) {
            streams.value.splice(number, 1);
        }
    }
})

group.onMessage((message, userInfo) => {
    messages.value.push(message.getData());
})

group.onStream((stream, userInfo) => {
    const st = streams.value.find(item => item.stream.id === stream.id);
    if (!st) {
        console.log('添加流', stream.getTracks())
        streams.value.push({stream, userInfo});
        // console.log(videos.value)
        nextTick(() => {
            const index = streams.value.findIndex(item => item.stream.id === stream.id);
            // videos.value[index].muted = false;
            // videos.value[index].play();
        })
        stream.addEventListener('addtrack', (e) => {
            // e.track.kind==audio
            // video
            if (e.track.kind === 'video') {
                console.log('添加视频')
            }
            if (e.track.kind === 'audio') {
                console.log('添加音频')
            }
            console.log('添加轨道', e)
        });
        stream.addEventListener('removetrack', (e) => {
            // e.track.kind==audio
            // video
            if (e.track.kind === 'video') {
                console.log('关闭视频')
            }
            if (e.track.kind === 'audio') {
                console.log('关闭音频')
            }
            const tracks = stream.getTracks();
            if (tracks.length === 0) {
                const number = streams.value.findIndex(s => s.stream.id === stream.id);
                if (number !== -1) {
                    streams.value.splice(number, 1);
                    console.log('移除流')
                }
            }
        })

    } else {
        stream.getTracks().forEach(track => {
            if (!st.stream.getTracks().some(t => t.kind === track.kind)) {
                st.stream.addTrack(track);
            }
        })
    }
})
group.start();
// navigator.mediaDevices.getUserMedia({video: true, audio: false}).then(stream => {
//   group.localStream = stream;
//   group.start();
// }).catch(error => {
//   console.error('Error getting local stream: ', error)
//   group.start();
// })

</script>

<template>
    <div>
        <input v-model="sendText" placeholder="Enter message">
        <button @click="sendMessage">Send</button>
        <button @click="sharedScreen">屏幕共享</button>
        <button @click="closeScreen">关闭屏幕共享</button>
        <button @click="openCamera">打开摄像头</button>
        <button @click="closeCamera">关闭摄像头</button>
        <button @click="openAudio">打开音频</button>
        <button @click="closeAudio">关闭音频</button>
    </div>
    <div v-for="(user, index) in otherUsers">
        {{ user.name }}:{{ user.id }}
    </div>
    <hr>
    <div v-for="(message, index) in messages">
        {{ message }}
    </div>
    <div v-for="(item, index) in streams" style="border: 1px solid black;">
        <video autoplay muted :srcObject="item.stream" :id="item.stream.id" ref="videos"></video>

    </div>
</template>

<style scoped lang="scss">
</style>
