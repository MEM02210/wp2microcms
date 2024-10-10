import fs from "fs";
import FormData from "form-data";
import axios from "axios";

import { glob } from "glob";
import "dotenv/config";

const serviceDomain = process.env.MICROCMS_SERVICE_DOMAIN;
const apiKey = process.env.MICROCMS_API_KEY;
const wordpressMediaBasePath = process.env.WORDPRESS_MEDIA_BASE_PATH;

// microCMSのマネジメントAPIにメディアファイルをアップロードする関数
const postMediaData = async (filePath) => {
	try {
		const form = new FormData();
		form.append("file", fs.createReadStream(filePath));

		const response = await axios.post(`https://${serviceDomain}.microcms-management.io/api/v1/media`, form, {
			headers: {
				...form.getHeaders(),
				"X-MICROCMS-API-KEY": apiKey
			}
		});
		console.log(`[Success] Uploaded image ${filePath}`);
		return response.data;
	} catch (error) {
		console.error(`[Error] uploading image ${filePath}:`, error.message);
		throw error;
	}
};

// ファイルごとにAPIリクエストを実行する
const postAllMediaData = async () => {
	// /data/mediaフォルダのファイルを再帰的に取得する
	const images = glob.sync("./data/media/**/*", {
		nodir: true, // ディレクトリを除外するかどうか
	});
	const uploadResults = [];
	for (const image of images) {
		try {
			const result = await postMediaData(image);
			const oldUrl = wordpressMediaBasePath + image.replace(/\\/g, "/").replace(/^data\/media\//, "");
			const newUrl = result.url;
			// レスポンスのURLを利用して対応表データを作成する
			uploadResults.push({ oldUrl, newUrl });
		} catch (error) {
			console.error(`[Error] Failed to upload ${image}`);
		}

		// レートリミット（IPアドレス単位）：10回 / 10秒
		await new Promise((resolve) => setTimeout(resolve, 1000));
	}
	// 作成した対応表データを/data/フォルダにmigrateMedia.jsonに保存する
	if (uploadResults.length !== 0) {
		fs.writeFileSync("./data/migrateMedia.json", JSON.stringify(uploadResults, null, 2));
		console.log("Created data/migrateMedia.json");
	}
};

postAllMediaData();
