import { reactive } from 'vue'

export const auth = reactive({
  user: null,
  token: localStorage.getItem('taichu_token') || null,

  get isLoggedIn() { return !!this.token },

  setSession(user, token) {
    this.user = user
    this.token = token
    localStorage.setItem('taichu_token', token)
  },

  clearSession() {
    this.user = null
    this.token = null
    localStorage.removeItem('taichu_token')
  }
})
