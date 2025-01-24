class Message {

    static db;

    static databaseName = 'IMDatabase';
    static objectStoreName = 'messages';

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

    async save() {
        return new Promise(async (resolve, reject) => {
            const db = await Message.getDb();
            const transaction = db.transaction(Message.objectStoreName, 'readwrite');
            const store = transaction.objectStore(Message.objectStoreName);
            const request = store.add(this); // 添加数据
            request.onsuccess = () => {
                resolve()
            };
            request.onerror = reject;
        });
    }

    static async list(offset = 0, limit = 100) {

        return new Promise(async (resolve, reject) => {
            const db = await Message.getDb();
            const transaction = db.transaction(Message.objectStoreName, 'readonly');
            const store = transaction.objectStore(Message.objectStoreName); // 获取存储空间

            const request = store.openCursor(null, 'prev');
            const results = [];
            let count = 0;
            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor && ++count >= offset && count < offset + limit) {
                    results.push(new Message(cursor.value));
                    cursor.continue();
                } else {
                    resolve(results);
                }
            };
            request.onerror = reject;
        });
    }

    static getDb() {
        return new Promise((resolve, reject) => {
            if (Message.db) {
                resolve(Message.db);
                return;
            }

            const request = indexedDB.open(Message.databaseName, 1);
            request.onupgradeneeded = function (event) {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(Message.objectStoreName)) {
                    db.createObjectStore(Message.objectStoreName, {keyPath: 'id', autoIncrement: true});
                }
            }
            request.onerror = function (e) {
                reject(e);
            }
            request.onsuccess = function (e) {
                Message.db = e.target.result;
                resolve(Message.db);
            }
        });

    }
}

export default Message;