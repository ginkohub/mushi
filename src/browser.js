/**
 * Copyright (C) 2025-2026 Ginko
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/
 *
 * This code is part of Ginko project (https://github.com/ginkohub)
 */

import { stringify } from "node:querystring";

class Browser {
  constructor(options = {}) {
    this.timeout = options.timeout || 30000;
  }

  static DEFAULT_HEADERS = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept-Language": "en-US,en;q=0.9",
    Accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  };

  static INSTAGRAM_HEADERS = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    Accept: "*/*",
    "X-IG-App-ID": "936619743392459",
    "X-ASBD-ID": "198387",
    "X-IG-WWW-Claim": "0",
    Origin: "https://www.instagram.com",
    Referer: "https://www.instagram.com/",
  };

  static FACEBOOK_HEADERS = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    Accept: "text/html,application/xhtml+xml",
    "Accept-Language": "en-US,en;q=0.9",
    "Sec-Fetch-Mode": "navigate",
  };

  async get(url, options = {}) {
    const headers = { ...Browser.DEFAULT_HEADERS, ...options.headers };
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        method: "GET",
        headers,
        signal: controller.signal,
        ...options,
      });

      const contentType = response.headers.get("content-type") || "";
      let data;
      if (contentType.includes("application/json")) {
        data = await response.json();
      } else {
        data = await response.text();
      }

      const headersObj = {};
      for (const [key, value] of response.headers) {
        headersObj[key.toLowerCase()] = value;
      }
      const setCookie = response.headers.get("set-cookie");
      if (setCookie) headersObj["set-cookie"] = setCookie;

      return { data, headers: headersObj };
    } finally {
      clearTimeout(timeout);
    }
  }

  async post(url, data, options = {}) {
    const headers = { ...Browser.DEFAULT_HEADERS, ...options.headers };
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers,
        body: typeof data === "string" ? data : JSON.stringify(data),
        signal: controller.signal,
        ...options,
      });

      const contentType = response.headers.get("content-type") || "";
      let responseData;
      if (contentType.includes("application/json")) {
        responseData = await response.json();
      } else {
        responseData = await response.text();
      }

      const headersObj = {};
      for (const [key, value] of response.headers) {
        headersObj[key.toLowerCase()] = value;
      }

      return { data: responseData, headers: headersObj };
    } finally {
      clearTimeout(timeout);
    }
  }

  async getHtml(url, options = {}) {
    return this.get(url, options);
  }

  async getJson(url, options = {}) {
    return this.get(url, {
      headers: {
        ...Browser.DEFAULT_HEADERS,
        Accept: "application/json",
        ...options.headers,
      },
      ...options,
    });
  }
}

const browser = new Browser();

/**
 * Ensure URL has https:// prefix
 * @param {string|null} url
 * @returns {string|null}
 */
const normalizeUrl = (url) => {
  if (!url) return null;
  if (url.startsWith("https://")) return url;
  return `https://www.${url}`;
};

/**
 * Decode escaped characters and HTML entities from scraped content
 * @param {string|null} str
 * @returns {string|null}
 */
const decodeVideoUrl = (str) => {
  if (!str) return null;
  return str
    .replace(/\\u002F/g, "/")
    .replace(/\\u/g, "%u")
    .replace(/\\/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&apos;/g, "'");
};

/**
 * Get session cookies (used for Instagram auth)
 * @returns {Promise<string>}
 */
async function getCookies() {
  try {
    const response = await browser.get("https://www.instagram.com/", {
      headers: browser.DEFAULT,
    });
    const cookies = response.headers["set-cookie"];
    if (!cookies) return "";
    if (Array.isArray(cookies)) return cookies.join("; ");
    return String(cookies);
  } catch (err) {
    console.error("Instagram session error:", err.message);
    return "";
  }
}

/**
 * Download TikTok video (no watermark)
 * @param {string} url - TikTok video URL
 */
export async function downloadTikTok(url) {
  try {
    const { data: pageData } = await browser.get(
      `https://www.tikwm.com/api/?url=${encodeURIComponent(url)}`,
      { headers: browser.DEFAULT },
    );

    if (pageData.code !== 0) {
      throw new Error(pageData.msg || "API returned non-zero code");
    }

    const video = pageData.data;
    if (!video) throw new Error("TikTok: Video data not found");

    return {
      success: true,
      platform: "TikTok",
      data: video,
    };
  } catch (err) {
    throw new Error(`TikTok download failed: ${err.message}`);
  }
}

/**
 * Download Facebook video (SD and HD)
 * @param {string} url - Facebook video URL
 */
export async function downloadFacebook(url) {
  try {
    let targetUrl = url;
    if (url.includes("fb.watch") || url.includes("share/v/")) {
      const { data: redirectData } = await browser.get(url);
      targetUrl = redirectData?.request?.uri?.href || url;
    }

    const fbHeaders = {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "en-US,en;q=0.9",
      "Sec-Fetch-Mode": "navigate",
    };

    const { data: html } = await browser.get(targetUrl, {
      headers: fbHeaders,
    });

    const sdMatch =
      html.match(/browser_native_sd_url":"([^"]+)"/) ||
      html.match(/sd_src:"([^"]+)"/);
    const hdMatch =
      html.match(/browser_native_hd_url":"([^"]+)"/) ||
      html.match(/hd_src:"([^"]+)"/);
    const thumbMatch =
      html.match(/preferred_thumbnail":{"image":{"uri":"([^"]+)"/) ||
      html.match(/thumbnailUrl":"([^"]+)"/);
    const titleMatch =
      html.match(/<title id="pageTitle">(.+?)<\/title>/) ||
      html.match(/<title>(.+?)<\/title>/);

    if (!sdMatch && !hdMatch) {
      throw new Error("Facebook: No video URL found. Video may be private.");
    }

    return {
      success: true,
      data: {
        title: titleMatch ? titleMatch[1] : "Facebook Video",
        thumbnail: thumbMatch ? decodeVideoUrl(thumbMatch[1]) : null,
        media: {
          hd: hdMatch ? decodeVideoUrl(hdMatch[1]) : null,
          sd: sdMatch ? decodeVideoUrl(sdMatch[1]) : null,
        },
        platform: "Facebook",
      },
    };
  } catch (err) {
    throw new Error(`Facebook download failed: ${err.message}`);
  }
}

/**
 * Download Instagram Reel/Post video
 * @param {string} url - Instagram URL
 */
export async function downloadInstagram(url) {
  try {
    const shortcodeMatch = url.match(/\/(p|reel|tv)\/([A-Za-z0-9_-]+)/);
    if (!shortcodeMatch) throw new Error("Instagram: Invalid URL format");
    const shortcode = shortcodeMatch[2];

    const cookies = await getCookies();
    const postData = stringify({
      variables: JSON.stringify({ shortcode, child_comment_count: null }),
      doc_id: "8845758582119845",
    });

    const { data } = await browser.post(
      "https://www.instagram.com/graphql/query/",
      postData,
      {
        headers: {
          ...browser.INSTAGRAM,
          Cookie: cookies,
          "Content-Type": "application/x-www-form-urlencoded",
          "X-CSRFToken": cookies.match(/csrftoken=([^;]+)/)?.[1] || "",
        },
        timeout: 10000,
      },
    );

    const media = data.data?.xdt_shortcode_media;
    if (!media)
      throw new Error("Instagram: Media not found or account is private");

    const isVideo = media.is_video;

    return {
      success: true,
      data: {
        shortcode: media.shortcode,
        caption: media.edge_media_to_caption?.edges?.[0]?.node?.text || "",
        author: {
          username: media.owner.username,
          full_name: media.owner.full_name,
        },
        media: {
          url: isVideo ? media.video_url : media.display_url,
          type: isVideo ? "video" : "image",
        },
        platform: "Instagram",
      },
    };
  } catch (err) {
    throw new Error(`Instagram download failed: ${err.message}`);
  }
}

/**
 * Download Likee video
 * @param {string} url - Likee video URL
 */
export async function downloadLikee(url) {
  try {
    const { data: html } = await browser.get(url, { headers: HEADERS.DEFAULT });

    const videoMatch =
      html.match(/"video_url":"([^"]+)"/) || html.match(/"playUrl":"([^"]+)"/);
    const titleMatch =
      html.match(/"title":"([^"]+)"/) || html.match(/<title>(.*?)<\/title>/);
    const authorMatch =
      html.match(/"nick_name":"([^"]+)"/) || html.match(/"userName":"([^"]+)"/);

    if (!videoMatch) throw new Error("Likee: No video URL found");

    return {
      success: true,
      data: {
        title: titleMatch ? titleMatch[1].trim() : "Likee Video",
        author: authorMatch ? authorMatch[1] : "Unknown",
        media: { url: decodeVideoUrl(videoMatch[1]) },
        platform: "Likee",
      },
    };
  } catch (err) {
    throw new Error(`Likee download failed: ${err.message}`);
  }
}

/**
 * Download Threads video
 * @param {string} url - Threads URL
 */
export async function downloadThreads(url) {
  try {
    const { data: html } = await browser.get(url, {
      headers: {
        ...browser.DEFAULT,
        Accept: "text/html,application/xhtml+xml",
        "Sec-Fetch-Mode": "navigate",
      },
    });

    // Try multiple patterns for video URL
    const patterns = [
      /"video_url"\s*:\s*"([^"]+)"/,
      /"video_versions"\s*:\s*\[.*?"url"\s*:\s*"([^"]+)"/,
      /<meta\s+property="og:video"\s+content="([^"]+)"/,
      /"playback_url"\s*:\s*"([^"]+)"/,
      /"video"\s*:\s*\{[^}]*"url"\s*:\s*"([^"]+)"/,
    ];

    let videoUrl = null;
    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match) {
        videoUrl = decodeVideoUrl(match[1]);
        break;
      }
    }

    // Fallback: find any mp4 in CDN
    if (!videoUrl) {
      const cdnMatch = html.match(/https:\/\/[^"'\s]*\.mp4[^"'\s]*/);
      if (cdnMatch) {
        videoUrl = decodeVideoUrl(cdnMatch[0]);
      }
    }

    if (!videoUrl) {
      throw new Error("Threads: No video found. Post may not contain a video.");
    }

    // Extract description
    const descPatterns = [
      /<meta\s+property="og:description"\s+content="([^"]+)"/,
      /"text"\s*:\s*"([^"]+)".*?"video_url"/,
      /"thread_caption"\s*:\s*"([^"]+)"/,
    ];
    let title = "Threads Video";
    for (const pattern of descPatterns) {
      const match = html.match(pattern);
      if (match) {
        title = decodeVideoUrl(match[1]);
        break;
      }
    }

    return {
      success: true,
      data: {
        title,
        media: { url: videoUrl },
        platform: "Threads",
      },
    };
  } catch (err) {
    throw new Error(`Threads download failed: ${err.message}`);
  }
}

/**
 * Download Pinterest video or image
 * @param {string} url - Pinterest URL
 */
export async function downloadPinterest(url) {
  try {
    const { data: html } = await browser.get(url, {
      headers: {
        ...browser.DEFAULT,
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      },
    });

    // Extract Video
    const videoMatch =
      html.match(
        /"url":"(https:\/\/v1\.pinimg\.com\/videos\/mc\/[^"]+\.m3u8)"/,
      ) ||
      html.match(
        /"url":"(https:\/\/v1\.pinimg\.com\/videos\/mc\/[^"]+\.mp4)"/,
      ) ||
      html.match(/video_list":.*?"url":"([^"]+)"/);

    // Extract Image (Try original first, then og:image)
    const imageMatch =
      html.match(/"images_orig":\{"url":"([^"]+)"\}/) ||
      html.match(/"originals":\{"url":"([^"]+)"\}/) ||
      html.match(/"url":"(https:\/\/i\.pinimg\.com\/originals\/[^"]+)"/) ||
      html.match(/property="og:image" content="([^"]+)"/) ||
      html.match(/content="([^"]+)"[^>]+property="og:image"/);

    const titleMatch =
      html.match(/property="og:title" content="([^"]+)"/) ||
      html.match(/content="([^"]+)"[^>]+property="og:title"/) ||
      html.match(/<title>(.*?)<\/title>/);

    const descMatch =
      html.match(/property="og:description" content="([^"]+)"/) ||
      html.match(/content="([^"]+)"[^>]+property="og:description"/) ||
      html.match(/"description":"([^"]+)"/);

    let mediaUrl = null;
    let type = "image";

    if (videoMatch) {
      mediaUrl = decodeVideoUrl(videoMatch[1]);
      type = mediaUrl.includes(".m3u8") ? "hls" : "mp4";
    } else if (imageMatch) {
      mediaUrl = decodeVideoUrl(imageMatch[1]);
      type = "image";
    }

    if (!mediaUrl) throw new Error("Pinterest: No media found on this pin");

    return {
      success: true,
      data: {
        title: titleMatch
          ? decodeVideoUrl(titleMatch[1]).trim()
          : descMatch
            ? decodeVideoUrl(descMatch[1]).trim()
            : "Pinterest Content",
        description: descMatch ? decodeVideoUrl(descMatch[1]).trim() : "",
        media: {
          url: mediaUrl,
          type: type,
        },
        platform: "Pinterest",
      },
    };
  } catch (err) {
    throw new Error(`Pinterest download failed: ${err.message}`);
  }
}

/**
 * Download CapCut video
 * @param {string} url - CapCut URL
 */
async function downloadCapCut(url) {
  try {
    const { data: html } = await browser.get(url, {
      headers: {
        ...browser.DEFAULT,
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Sec-Fetch-Mode": "navigate",
      },
    });

    let videoInfo = null;

    const ogVideoMatch =
      html.match(
        /property=["']og:video:url["'][^>]*content=["']([^"']+)["']/i,
      ) ||
      html.match(/property=["']og:video["'][^>]*content=["']([^"']+)["']/i);
    if (ogVideoMatch) {
      videoInfo = {
        title: "CapCut Video",
        video_url: decodeVideoUrl(ogVideoMatch[1]),
      };
    }

    if (!videoInfo) {
      const ogUrlMatch = html.match(
        /property=["']og:title["'][^>]*content=["']([^"']+)["']/i,
      );
      const twitterMatch = html.match(
        /name=["']twitter:player["'][^>]*content=["']([^"']+)["']/i,
      );
      if (twitterMatch && !videoInfo) {
        videoInfo = {
          title: ogUrlMatch
            ? ogUrlMatch[1].replace("CapCut template: ", "")
            : "CapCut Video",
          video_url: decodeVideoUrl(twitterMatch[1]),
        };
      }
    }

    if (!videoInfo?.video_url) {
      const videoMatch = html.match(
        /window\.__INITIAL_STATE__\s*=\s*({.*?});/s,
      );
      if (videoMatch) {
        try {
          const parsed = JSON.parse(videoMatch[1]);
          const pageData = parsed?.newHeader?.query || parsed?.pageData;
          if (pageData?.shareToken) {
            const apiUrl = `https://www.capcut.com/api/template/detail?template_id=${pageData.template_id || ""}&share_token=${pageData.shareToken}&platform=copy_link&region=US&language=en`;
            const { data: apiData } = await browser.get(apiUrl, {
              headers: browser.DEFAULT,
            });
            if (apiData?.data?.video_info) {
              videoInfo = {
                title: apiData.data.template_name || "CapCut Video",
                video_url:
                  apiData.data.video_info.video_url ||
                  apiData.data.video_info.play_url,
              };
            }
          }
        } catch { }
      }
    }

    if (!videoInfo?.video_url) {
      throw new Error("CapCut: Video data not found");
    }

    return {
      success: true,
      data: {
        title: videoInfo.title || "CapCut Video",
        media: {
          url: videoInfo.video_url,
        },
        platform: "CapCut",
      },
    };
  } catch (err) {
    throw new Error(`CapCut download failed: ${err.message}`);
  }
}

/**
 * Auto-detect platform and download video
 * @param {string} url - Any supported video URL
 * @returns {Promise<object>}
 */
const normalizeResponse = (platform, data, mediaUrl, explicitType = null) => {
  const isArray = Array.isArray(mediaUrl);
  const count = isArray ? mediaUrl.length : mediaUrl ? 1 : 0;
  let type = explicitType;

  if (!type) {
    if (isArray) {
      type = "image";
    } else if (typeof mediaUrl === "string") {
      if (
        mediaUrl.includes(".mp4") ||
        mediaUrl.includes(".m3u8") ||
        mediaUrl.includes("/video/")
      ) {
        type = "video";
      } else if (
        mediaUrl.includes(".jpg") ||
        mediaUrl.includes(".jpeg") ||
        mediaUrl.includes(".png") ||
        mediaUrl.includes(".webp") ||
        mediaUrl.includes("image")
      ) {
        type = "image";
      } else {
        type = "unknown";
      }
    } else {
      type = "unknown";
    }
  }

  return {
    platform,
    title: data?.title || data?.caption || data?.name || "Untitled",
    media: {
      type,
      url: isArray ? mediaUrl[0] : mediaUrl,
      urls: isArray ? mediaUrl : mediaUrl ? [mediaUrl] : [],
      count,
      thumbnail: data?.thumbnail || data?.cover || data?.coverUrl,
      duration: data?.duration,
      width: data?.width,
      height: data?.height,
    },
    metadata: {
      author:
        data?.author?.nickname ||
        data?.author?.unique_id ||
        data?.username ||
        data?.creator ||
        data?.nickname,
      description: data?.description || data?.caption,
      shareUrl: data?.shareUrl || data?.share_link,
    },
  };
};

export async function download(url) {
  let result;
  let platform;
  let mediaUrl;
  let mediaType;

  if (/tiktok\.com/.test(url)) {
    platform = "TikTok";
    result = await downloadTikTok(url);
    const video = result.data;
    const images = video.images || video.image_post_info?.images || [];
    if (images.length > 0) {
      mediaUrl = images;
      mediaType = "image";
    } else {
      mediaUrl = video.hdplay || video.play || video.wmplay;
      mediaType = "video";
    }
  } else if (/facebook\.com|fb\.watch|share\/v\//.test(url)) {
    platform = "Facebook";
    result = await downloadFacebook(url);
    mediaUrl =
      result.data?.media?.url ||
      result.data?.media?.hd ||
      result.data?.media?.sd;
    mediaType = "video";
  } else if (/instagram\.com/.test(url)) {
    platform = "Instagram";
    result = await downloadInstagram(url);
    mediaUrl = result.data?.media?.url || result.data?.downloadUrl;
    mediaType = result.data?.media_type === "image" ? "image" : "video";
  } else if (/likee\.video|l\.likee/.test(url)) {
    platform = "Likee";
    result = await downloadLikee(url);
    mediaUrl = result.data?.media?.url || result.data?.video_url;
    mediaType = "video";
  } else if (/threads\.net|threads\.com/.test(url)) {
    platform = "Threads";
    result = await downloadThreads(url);
    mediaUrl = result.data?.media?.url || result.data?.downloadUrl;
    mediaType = "video";
  } else if (/pinterest\.com|pin\.it/.test(url)) {
    platform = "Pinterest";
    result = await downloadPinterest(url);
    mediaUrl =
      result.data?.media?.url ||
      result.data?.downloadUrl ||
      result.data?.video_url;
    const urlLower = (mediaUrl || "").toLowerCase();
    mediaType =
      urlLower.includes(".mp4") ||
        urlLower.includes("/video/") ||
        urlLower.includes(".m3u8")
        ? "video"
        : "image";
  } else if (/capcut\.com/.test(url)) {
    platform = "CapCut";
    result = await downloadCapCut(url);
    mediaUrl = result.data?.media?.url;
    mediaType = "video";
  } else {
    throw new Error(`Unsupported platform: ${url}`);
  }

  return normalizeResponse(platform, result.data, mediaUrl, mediaType);
}

export default {
  Browser,
  browser,
  download,
  normalizeUrl,
  tiktok: downloadTikTok,
  facebook: downloadFacebook,
  instagram: downloadInstagram,
  likee: downloadLikee,
  threads: downloadThreads,
  pinterest: downloadPinterest,
  capcut: downloadCapCut,
};
