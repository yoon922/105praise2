// ⚠️ 아래 값을 본인의 Firebase 프로젝트 설정으로 반드시 교체하세요.
// README.md의 "1. Firebase 프로젝트 만들기" 단계를 먼저 따라하세요.
// Firebase 콘솔 > 프로젝트 설정 > 내 앱 > SDK 설정 및 구성 에서 복사할 수 있습니다.

const firebaseConfig = {
  apiKey: "AIzaSyDhiY0nQ7HMZ09S2JqOCT-5jsF2NONY5eU",
  authDomain: "compliment-7c157.firebaseapp.com",
  projectId: "compliment-7c157",
  storageBucket: "compliment-7c157.firebasestorage.app",
  messagingSenderId: "447889431048",
  appId: "1:447889431048:web:8706661a54ef2d05160fbd"
};

// 선생님 로그인 비밀번호 (원하는 값으로 바꿔서 사용하세요)
const TEACHER_PASSWORD = "teacher1234";

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
