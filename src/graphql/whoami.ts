export default `
query globalData {
    userStatus {
      userId
      username
      avatar
      isSignedIn
      isMockUser
      isPremium
      isAdmin
      isSuperuser
      isTranslator
      permissions
    }
  }
  `;
