const scriptName = "instaconverter";

function response(room, msg, sender, isGroupChat, replier, imageDB, packageName) {
  if (msg.includes("instagram.com/p/") || msg.includes("instagram.com/reel/")) {
    try {
      var instaUrlMatch = msg.match(/(https?:\/\/(?:www\.)?instagram\.com\/(?:p|reel)\/[^\s?]+)/);
      if (instaUrlMatch) {
        var targetUrl = instaUrlMatch[0];
        var renderApiUrl = "https://내서버이름.onrender.com/insta?url=" + encodeURIComponent(targetUrl);
        var responseJson = Utils.getWebText(renderApiUrl);
        
        if (responseJson) {
          var parsedData = JSON.parse(responseJson);
          var instaContent = parsedData.content || "내용을 불러올 수 없는 포스트이거나 비공개 계정입니다.";
          var instaImageStr = parsedData.image || "";
          
          var resultText = "📸 인스타그램 미리보기\n\n💬 내용:\n" + instaContent;
          if (instaImageStr !== "") {
            resultText += "\n\n🖼️ 썸네일 주소:\n" + instaImageStr;
          }
          replier.reply(room, resultText);
        }
      }
    } catch (instaError) {
      replier.reply(room, "[Error] 인스타그램 데이터 조회 실패");
    }
  }
}

function onCreate(savedInstanceState, activity) {}
function onStart(activity) {}
function onResume(activity) {}
function onPause(activity) {}
function onStop(activity) {}
