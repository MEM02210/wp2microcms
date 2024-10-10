import * as cheerio from "cheerio";
import "dotenv/config";

const wordpressMediaBasePath = process.env.WORDPRESS_MEDIA_BASE_PATH;

export const replaceContent = (content, migrateMedia) => {
	const cheerioDom = cheerio.load(content);

	// 画像の置換処理
	cheerioDom("img").replaceWith((index, element) => {
		const oldSrc = cheerioDom(element).attr("src");

		// WordPressのメディアパスに一致するものがあれば、microCMSのメディアパスに置換する
		if (oldSrc.includes(wordpressMediaBasePath)) {
			if (migrateMedia.length > 0) {
				migrateMedia.some((media) => {
					if (media["oldUrl"] === oldSrc) {
						const newSrc = media["newUrl"];
						cheerioDom(element).attr("src", newSrc);
						return true;
					}
				});
			} else {
				console.log("[Error] replaceContent関数の第二引数のmigrateMediaが不正です。");
			}
		}
		return cheerioDom(element).toString();
	});

	// タグの置換処理（移行先コンテンツのヘッドラインに合わせる場合など）
	// cheerioDom("h4").replaceWith(function () {
	// 	const newTag = cheerioDom("<h2></h2>");

	// 	newTag.attr(cheerioDom(this).attr());

	// 	return newTag.html(cheerioDom(this).html()).toString();
	// });

	return cheerioDom("body").html();
};
