import "dotenv/config";
import xml2js from "xml2js";
import crypto from "crypto";

/**
 * XMLデータを読み込み、JSONオブジェクトに変換する関数
 * @param {string} data - XMLデータ
 * @returns {Promise} - JSONオブジェクトに変換されたデータ
 */
export const loadXml = async (data) => {
	return new Promise((resolve, reject) =>
		xml2js.parseString(data, (err, result) => {
			if (err) {
				return reject(err);
			} else {
				return resolve(result);
			}
		})
	);
};

/**
 * キーワードをハッシュ化し、指定された桁数に制限する関数
 * @param {string} keyword - ハッシュ化するキーワード
 * @param {number} length - 返却するハッシュ値の桁数
 * @returns {string} - 指定された桁数のハッシュ値
 */
export const hashKeyword = (keyword, length = 10) => {
	// SHA-256ハッシュを生成
	const hash = crypto.createHash("sha256").update(keyword).digest("hex");
	// 指定された桁数に制限
	return hash.substring(0, length);
};

const serviceDomain = process.env.MICROCMS_SERVICE_DOMAIN;
const apiKey = process.env.MICROCMS_API_KEY;

/**
 * microCMSのAPIにコンテンツを送信する関数
 * @param {string} endpoint - 送信先のエンドポイント
 * @param {object} requestBody - 送信するリクエストボディ
 * @param {boolean} isDraft - 下書き状態でコンテンツを作成するかどうか
 * @returns {Promise<Response>} - fetchのレスポンス
 */
export const executePostAPI = async (endpoint, arrayRequestBody, isDraft = false) => {
	try {
		// isDraftがtrueの場合、status=draftをクエリパラメータとして追加して下書き状態でコンテンツを作成する
		const url = isDraft
			? `https://${serviceDomain}.microcms.io/api/v1/${endpoint}?status=draft`
			: `https://${serviceDomain}.microcms.io/api/v1/${endpoint}`;

		const requestParameters = [];
		let count = 0;
		let listCount = 0;

		// リクエストパラメータのまとめ処理
		// microCMSのAPI制限があるので、5個ずつにまとめる
		arrayRequestBody.forEach((requestBody) => {
			if (count <= 0) {
				requestParameters.push([]);
			}

			const parameters = {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"X-MICROCMS-API-KEY": apiKey
				},
				body: JSON.stringify(requestBody)
			};

			requestParameters[listCount].push(parameters);
			count++;
			if (count >= 5) {
				count = 0;
				listCount++;
			}
		});

		// 複数のfetchを並行して実行
		let log = "";
		const allResult = [];
		for (let i = 0; i < requestParameters.length; i++) {
			console.log("######################################################################");
			console.log(`${i + 1}/${requestParameters.length}`);

			const fetchProcesses = [];
			requestParameters[i].forEach((parameters) => {
				console.log(parameters.body.substr(0, 70));
				fetchProcesses.push(fetch(url, parameters));
			});

			const results = await Promise.all(fetchProcesses);

			for (let j = 0; j < results.length; j++) {
				const data = JSON.parse(requestParameters[i][j].body);
				const message = await results[j].json();
				allResult.push({ ...data, ...message });

				if (results[j].status !== 201) {
					log += "------------------------------------------------------------------------\n";
					log += message + "\n";
					log += requestParameters[i][j].body + "\n";
					log += "------------------------------------------------------------------------\n\n";

					console.log("----ERROR---------------------------------------------------------------");
					console.log(message);
					console.log(requestParameters[i][j].body.substr(0, 70));
					console.log("------------------------------------------------------------------------");
				}
			}

			// WRITE API（POST / PUT / PATCH / DELETE）のレートリミット（サービス単位）：5回 / 1秒
			await new Promise((resolve) => setTimeout(resolve, 1000));
		}
		if (log !== "") fs.writeFileSync("./data/log.txt", log);
		return allResult;
	} catch (error) {
		console.error(error);
	}
};
