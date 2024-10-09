class CommonUtil {
	static isArray(obj) {
		return obj instanceof Array || Object.prototype.toString.call(obj) == '[object Array]'
	}
}
export default CommonUtil