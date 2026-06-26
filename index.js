const express = require('express');
const axios = require('axios');
const app = express();

app.use(express.json());

// 카카오톡 챗봇 스킬 엔드포인트
app.post('/api/music', async (req, res) => {
    // 카카오톡 유저가 보낸 메시지 추출
    const msg = req.body.userRequest.utterance || "";
    
    // 1. 스포티파이 링크를 받았을 때 ➡️ 유튜브로 변환
    if (msg.includes("spotify.com")) {
        try {
            const urlMatch = msg.match(/(https?:\/\/[^\s]+spotify\.com[^\s]+)/);
            if (urlMatch) {
                const spotifyUrl = urlMatch[0];
                const responseHtml = await axios.get(spotifyUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
                const spHtml = responseHtml.data;
                
                let title = "";
                let artist = "Unknown";
                let album = "Unknown";

                const jsonMatch = spHtml.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/i);
                if (jsonMatch && jsonMatch[1]) {
                    try {
                        const jsonData = JSON.parse(jsonMatch[1].trim());
                        if (jsonData.name) title = jsonData.name;
                        if (jsonData.byArtist && jsonData.byArtist[0] && jsonData.byArtist[0].name) {
                            artist = jsonData.byArtist[0].name;
                        }
                        if (jsonData.inAlbum && jsonData.inAlbum.name) {
                            album = jsonData.inAlbum.name;
                        }
                    } catch (e) {}
                }

                if (!title) {
                    const titleReg = spHtml.match(/<meta\s+property="og:title"\s+content="([^"]+)"/i);
                    if (titleReg && titleReg[1]) title = titleReg[1].trim();
                }

                if (artist === "Unknown" || album === "Unknown") {
                    const descReg = spHtml.match(/<meta\s+property="og:description"\s+content="([^"]+)"/i);
                    if (descReg && descReg[1]) {
                        const descContent = descReg[1];
                        if (descContent.includes(" · ")) {
                            const parts = descContent.split(" · ");
                            if (artist === "Unknown") artist = parts[0].trim();
                            
                            const remain = parts[1];
                            if (remain.includes(" Song ")) {
                                const songParts = remain.split(" Song ");
                                if (album === "Unknown") album = songParts[0].trim();
                                if (!title) title = songParts[1].trim();
                            } else {
                                if (album === "Unknown") album = remain.trim();
                            }
                        }
                    }
                }

                if (title) {
                    const songSearchQuery = (artist !== "Unknown" ? artist + " " : "") + title;
                    const youtubeSearchUrl = "https://www.youtube.com/results?search_query=" + encodeURIComponent(songSearchQuery) + "&sp=EgIQAQ%253D%253D";
                    const ytResponse = await axios.get(youtubeSearchUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
                    const spotifyYoutubeHtml = ytResponse.data;
                    const videoIdMatch = spotifyYoutubeHtml.match(/\"videoId\":\"([^\"]+)\"/i) || spotifyYoutubeHtml.match(/v=([a-zA-Z0-9_-]{11})/i);
                    
                    let finalYoutubeUrl = "";
                    if (videoIdMatch && videoIdMatch[1]) {
                        finalYoutubeUrl = "https://www.youtube.com/watch?v=" + videoIdMatch[1];
                    } else {
                        finalYoutubeUrl = "https://www.youtube.com/results?search_query=" + encodeURIComponent(songSearchQuery);
                    }

                    return sendKakaoResponse(res, `🔗 Link: ${finalYoutubeUrl}\n\nArtist : ${artist}\nAlbum : ${album}\nSong : ${title}`);
                }
            }
        } catch (error) {
            return sendKakaoResponse(res, "[Error] 스포티파이 링크 변환 실패");
        }
    }

    // 2. 유튜브 링크를 받았을 때 ➡️ 스포티파이로 변환
    if (msg.includes("youtube.com/watch") || msg.includes("youtu.be/")) {
        try {
            const ytUrlMatch = msg.match(/(https?:\/\/[^\s]*(youtube\.com|youtu\.be)[^\s]+)/);
            if (ytUrlMatch) {
                const youtubeUrl = ytUrlMatch[0];
                const ytResponse = await axios.get(youtubeUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
                const ytHtml = ytResponse.data;
                
                let ytTitle = "";
                const ytTitleReg = ytHtml.match(/<meta\s+name="title"\s+content="([^"]+)"/i) || ytHtml.match(/<title>(.*?)<\/title>/i);
                if (ytTitleReg && ytTitleReg[1]) {
                    ytTitle = ytTitleReg[1].replace("- YouTube", "").trim();
                }

                if (ytTitle) {
                    let cleanedTitle = ytTitle.replace(/\[.*?\]|\(.*?\)/g, "").trim();
                    
                    const featMatch = cleanedTitle.match(/(.*)\s+(feat|featuring|ft)\b.*/i);
                    if (featMatch && featMatch[1]) {
                        cleanedTitle = featMatch[1].trim();
                    }

                    let spTitle = cleanedTitle;
                    let spArtist = "Unknown";
                    
                    if (cleanedTitle.includes(" - ")) {
                        const dashParts = cleanedTitle.split(" - ");
                        spArtist = dashParts[0].trim();
                        spTitle = dashParts[1].trim();
                    } else if (cleanedTitle.includes("-")) {
                        const hyphenParts = cleanedTitle.split("-");
                        spArtist = hyphenParts[0].trim();
                        spTitle = hyphenParts[1].trim();
                    }

                    const searchQuery = (spArtist !== "Unknown") ? spArtist + " " + spTitle : spTitle;
                    const spotifySearchUrl = "https://open.spotify.com/search/" + encodeURIComponent(searchQuery);
                    const spSearchResponse = await axios.get(spotifySearchUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
                    const searchSpHtml = spSearchResponse.data;
                    
                    const trackMatch = searchSpHtml.match(/"https:\/\/open\.spotify\.com\/track\/([a-zA-Z0-9]+)"/i) || searchSpHtml.match(/href="\/track\/([a-zA-Z0-9]+)"/i);
                    
                    if (trackMatch && trackMatch[1]) {
                        const finalSpotifyUrl = "https://open.spotify.com/track/" + trackMatch[1];
                        
                        let spAlbum = "(앨범 정보 검색실패)";
                        try {
                            const targetSpResponse = await axios.get(finalSpotifyUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
                            const targetSpHtml = targetSpResponse.data;
                            const targetJsonMatch = targetSpHtml.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/i);
                            if (targetJsonMatch && targetJsonMatch[1]) {
                                const targetJson = JSON.parse(targetJsonMatch[1].trim());
                                if (targetJson.inAlbum && targetJson.inAlbum.name) {
                                    spAlbum = targetJson.inAlbum.name;
                                }
                            }
                            if (spAlbum === "(앨범 정보 검색실패)") {
                                const targetDescReg = targetSpHtml.match(/<meta\s+property="og:description"\s+content="([^"]+)"/i);
                                if (targetDescReg && targetDescReg[1] && targetDescReg[1].includes(" · ")) {
                                    const targetParts = targetDescReg[1].split(" · ");
                                    if (targetParts[1] && targetParts[1].includes(" Song ")) {
                                        spAlbum = targetParts[1].split(" Song ")[0].trim();
                                    } else if (targetParts[1]) {
                                        spAlbum = targetParts[1].trim();
                                    }
                                }
                            }
                        } catch (albumE) {
                            spAlbum = "(앨범 정보 검색실패)";
                        }

                        return sendKakaoResponse(res, `🔗 Link: ${finalSpotifyUrl}\n\nArtist : ${spArtist}\nAlbum : ${spAlbum}\nSong : ${spTitle}`);
                    } else {
                        return sendKakaoResponse(res, `❌ 스포티파이 링크 검색 실패\n\nArtist : ${spArtist}\nAlbum : (링크 검색 실패로 조회 불가)\nSong : ${spTitle}`);
                    }
                }
            }
        } catch (ytError) {
            return sendKakaoResponse(res, "스포티파이 검색 중 일시적 오류가 발생했습니다.");
        }
    }

    // 음악 링크가 아닐 경우 기본 응답 처리
    return sendKakaoResponse(res, "유튜브 또는 스포티파이 링크를 입력해 주세요!");
});

// 카카오톡 오픈빌더 전용 규격에 맞춰 JSON 반환하는 함수
function sendKakaoResponse(res, textMessage) {
    return res.json({
        version: "2.0",
        template: {
            outputs: [
                {
                    simpleText: {
                        text: textMessage
                    }
                }
            ]
        }
    });
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
