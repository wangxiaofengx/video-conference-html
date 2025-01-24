class Message {

    static DB;

    static DbName = 'imdb';
    static MessageTableName = 'messages';
    static ImageTableName = 'images';

    constructor(options) {
        this.type = null;
        this.data = null;
        this.sender = null;
        this.receiver = null;
        this.timestamp = new Date().toLocaleString();
        Object.assign(this, options);
    }

    isImage() {
        return this.type === 'image';
    }

    isSystem() {
        return this.type === 'system';
    }

    async save() {
        const that = this;
        return new Promise(async (resolve, reject) => {
            const db = await Message.getDb();
            const transaction = db.transaction(Message.MessageTableName, 'readwrite');
            const store = transaction.objectStore(Message.MessageTableName);
            const request = store.add(this); // 添加数据
            request.onsuccess = async (event) => {
                const id = event.target.result;
                if (that.isImage()) {
                    await that.saveImage(id, that.getData())
                }
                resolve(id)
            };
            request.onerror = reject;
        });
    }

    async saveImage(id, url) {
        return new Promise(async (resolve, reject) => {
            const response = await fetch(url);
            const blob = await response.blob();
            const db = await Message.getDb();
            const transaction = db.transaction(Message.ImageTableName, 'readwrite');
            const store = transaction.objectStore(Message.ImageTableName);
            const request = store.add({id: id, blob: blob});
            request.onsuccess = (event) => {
                resolve()
            };
            request.onerror = reject;
        })
    }

    async getImageUrl(id) {
        return new Promise(async (resolve, reject) => {
            const db = await Message.getDb();
            const transaction = db.transaction(Message.ImageTableName, 'readonly');
            const store = transaction.objectStore(Message.ImageTableName);
            const request = store.get(id);
            request.onsuccess = (event) => {
                const result = event.target.result;
                if (!result) {
                    resolve('');
                    return;
                }
                const blob = result.blob;
                const url = URL.createObjectURL(blob);
                resolve(url);
            }
            request.onerror = reject;
        })
    }

    static async list(offset = 0, limit = 100) {

        return new Promise(async (resolve, reject) => {
            const db = await Message.getDb();
            const transaction = db.transaction(Message.MessageTableName, 'readonly');
            const store = transaction.objectStore(Message.MessageTableName); // 获取存储空间

            const request = store.openCursor(null, 'prev');
            const results = [];
            let count = 0;
            request.onsuccess = async (event) => {
                const cursor = event.target.result;
                if (cursor && ++count >= offset && count < offset + limit) {
                    const message = new Message(cursor.value);
                    results.push(message);
                    cursor.continue();
                } else {
                    for (const message of results.filter(item => item.isImage())) {
                        const url = await message.getImageUrl(message.getId());
                        message.setData(url)
                    }
                    resolve(results);
                }
            };
            request.onerror = reject;
        });
    }

    static getDb() {
        return new Promise((resolve, reject) => {
            if (Message.DB) {
                resolve(Message.DB);
                return;
            }

            const request = indexedDB.open(Message.DbName, 1);
            request.onupgradeneeded = function (event) {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(Message.MessageTableName)) {
                    db.createObjectStore(Message.MessageTableName, {keyPath: 'id', autoIncrement: true});
                }
                if (!db.objectStoreNames.contains(Message.ImageTableName)) {
                    db.createObjectStore(Message.ImageTableName, {keyPath: 'id', autoIncrement: false});
                }
            }
            request.onerror = function (e) {
                reject(e);
            }
            request.onsuccess = function (e) {
                Message.DB = e.target.result;
                resolve(Message.DB);
            }
        });

    }


    getId() {
        return this.id;
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