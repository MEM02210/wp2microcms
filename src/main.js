import fs from "fs";
import { config } from "./config.js";
import { loadXml, hashKeyword, executePostAPI } from "./libs/lib.js";
import { replaceContent } from "./libs/replace-content.js";

const xmlFile = fs.readFileSync(`./data/${config.xmlPath}`, "utf-8");
const xmlData = await loadXml(xmlFile);

const migrateWordPress = async () => {
	// カテゴリ登録処理
	if (config.category.execute) {
		if (config.category.taxonomy) {
			const arrayTerm = [];

			xmlData.rss.channel[0]["wp:term"].forEach((term) => {
				if (term["wp:term_taxonomy"][0] === config.category.taxonomy) {
					arrayTerm.push(term);
				}
			});

			if (arrayTerm.length !== 0) {
				const categoryList = [];
				arrayTerm.forEach((term) => {
					const category = {};
					category.id = hashKeyword(term["wp:term_slug"][0]);
					const apiSchema = config.category.apiSchema;
					if (apiSchema.name) category.name = term["wp:term_name"] ? term["wp:term_name"][0] : null;
					if (apiSchema.description)
						category.description = term["wp:term_description"] ? term["wp:term_description"][0] : null;

					categoryList.push(category);
				});
				// categoryList = [{id: "XXXXXXXXXX", name: "hogehoge", description: "fugafuga"}, ...]

				// カテゴリ用のコンテンツAPIに送信
				if (config.api) {
					const result = await executePostAPI(config.category.apiName, categoryList);
					// console.log("result:", result);
					console.log("カテゴリの登録処理が完了しました。");
				} else {
					console.log(
						"[Warning] config.apiがfalseのため、カテゴリの登録は行いません。\nAPIに送信されるデータを data/output_category.json に出力しました。"
					);
					fs.writeFileSync("./data/output_category.json", JSON.stringify(categoryList));
				}
			} else {
				console.log("[Warning] config.category.taxonomyに設定されたカテゴリが見つかりませんでした。");
			}
		} else {
			console.log("[Error] config.category.taxonomyが設定されていません。");
		}
	}

	// タグ登録処理
	if (config.tag.execute) {
		if (config.tag.taxonomy) {
			const arrayTerm = [];

			xmlData.rss.channel[0]["wp:term"].forEach((term) => {
				if (term["wp:term_taxonomy"][0] === config.tag.taxonomy) {
					arrayTerm.push(term);
				}
			});

			if (arrayTerm.length !== 0) {
				const tagList = [];
				arrayTerm.forEach((term) => {
					const tag = {};
					tag.id = hashKeyword(term["wp:term_slug"][0]);
					const apiSchema = config.tag.apiSchema;
					if (apiSchema.name) tag.name = term["wp:term_name"] ? term["wp:term_name"][0] : null;
					if (apiSchema.description)
						tag.description = term["wp:term_description"] ? term["wp:term_description"][0] : null;

					tagList.push(tag);
				});
				// tagList = [{id: "XXXXXXXXXX", name: "hogehoge", description: "fugafuga"}, ...]

				// タグ用のコンテンツAPIに送信
				if (config.api) {
					const result = await executePostAPI(config.tag.apiName, tagList);
					// console.log("result:", result);
					console.log("タグの登録処理が完了しました。");
				} else {
					console.log(
						"[Warning] config.apiがfalseのため、タグの登録は行いません。\nAPIに送信されるデータを data/output_tag.json に出力しました。"
					);
					fs.writeFileSync("./data/output_tag.json", JSON.stringify(tagList));
				}
			} else {
				console.log("[Warning] config.tag.taxonomyに設定されたタグが見つかりませんでした。");
			}
		} else {
			console.log("[Error] config.tag.taxonomyが設定されていません。");
		}
	}

	// コンテンツ登録処理
	const contents = [];
	const draftContents = [];
	const items = xmlData.rss.channel[0].item;
	// メディアデータの取得
	const attachmentItems = items.filter((item) => item["wp:post_type"][0] === "attachment");
	// メディアの移行対応表の取得
	let migrateMedia = [];
	if (fs.existsSync("./data/migrateMedia.json")) {
		migrateMedia = JSON.parse(fs.readFileSync("./data/migrateMedia.json", "utf-8"));
	} else {
		console.log(
			"[Warning] data/migrateMedia.jsonが見つかりませんでした。\n画像の移行処理を先に行わない場合、画像の移行は行われません。"
		);
	}
	// 指定した投稿タイプかつ公開済みの記事のみを抽出
	let filteredItems = items.filter(
		(item) => item["wp:post_type"][0] === config.postType && item["wp:status"][0] === "publish"
	);
	// config.draftがtrueの場合、未公開記事を抽出して実行する
	const draftStatuses = ["draft", "future", "pending", "private", "auto-draft"];
	if (config.draft) {
		// [WordPressステータスの選別]
		// 	publish: 公開済みの投稿
		// 	future: 予約投稿（未来の日付で公開予定の投稿）
		// 	draft: 下書きの投稿
		// 	pending: 承認待ちの投稿
		// 	private: 非公開の投稿
		// 	trash: ゴミ箱に入っている投稿
		// 	auto-draft: 自動保存された下書き
		// 	inherit: 添付ファイルやリビジョンなど、親投稿のステータスを継承する投稿
		// 	any: 任意のステータス（検索クエリなどで使用）
		const draftItems = items.filter(
			(item) => item["wp:post_type"][0] === config.postType && draftStatuses.includes(item["wp:status"][0])
		);
		filteredItems.push(...draftItems);
	}
	if (filteredItems.length !== 0) {
		let i = 0;
		filteredItems.forEach((item) => {
			// ローデータ用のオジェクト定義
			const contentsItem = {};

			// コンテンツ数制限
			if (config.limit !== false && i >= config.limit) {
				console.log(
					"[Warning] config.limitに設定したコンテンツ数に達しました。\nAPIに送信されるデータを data/output_contents.json に出力しました。"
				);
				fs.writeFileSync("./data/output_contents.json", JSON.stringify(contents));
				process.exit(0);
			}

			// コンテンツID（組み込みスキーマ）の設定
			contentsItem["id"] = hashKeyword(item["wp:post_id"][0]);

			// 下書き記事かどうかの判定
			const isDraftItem = draftStatuses.includes(item["wp:status"][0]);

			// 公開日時（組み込みスキーマ）の設定
			if (!isDraftItem) {
				// referrer: https://blog.microcms.io/update-api-for-published-date/
				// 	Key: publishedAt
				// 	ValueType: Date(ISO 8601)
				contentsItem["publishedAt"] = new Date(item["wp:post_date_gmt"][0]); // 公開日時で登録する場合
				// contentsItem["publishedAt"] = new Date(item["wp:post_modified_gmt"][0]); // 更新日時で登録する場合
			}

			// タイトルの設定
			if (config.apiSchema.title) contentsItem["title"] = item["title"][0];

			// 本文コンテンツの設定
			if (config.apiSchema.contents) {
				const contentsBody = replaceContent(item["content:encoded"][0], migrateMedia);

				contentsItem["contents"] = contentsBody;
			}

			// 著者の設定
			if (config.apiSchema.author) contentsItem["author"] = item["dc:creator"][0];

			// アイキャッチ画像の設定
			if (config.apiSchema.eyecatch && !isDraftItem) {
				if (item["wp:postmeta"] && migrateMedia.length !== 0) {
					const thumbnailMeta = item["wp:postmeta"].find(
						(meta) => meta["wp:meta_key"][0] === "_thumbnail_id"
					);
					if (thumbnailMeta) {
						const thumbnailPostId = thumbnailMeta["wp:meta_value"][0];
						// メディアの検索
						attachmentItems.some((attachment) => {
							if (attachment["wp:post_id"][0] === thumbnailPostId) {
								const attachment_url = attachment["wp:attachment_url"][0];

								migrateMedia.some((media) => {
									if (media["oldUrl"] === attachment_url) {
										contentsItem["eyecatch"] = media["newUrl"];
										return true;
									}
								});
								return true;
							}
						});
					}
				}
			}

			// カテゴリー／タグの設定
			if (item["category"] !== undefined) {
				const categories = [];
				const tags = [];
				item["category"].forEach((taxonomyItem) => {
					if (taxonomyItem["$"]["domain"] === config.category.taxonomy) {
						categories.push(hashKeyword(taxonomyItem["$"]["nicename"]));
					} else if (taxonomyItem["$"]["domain"] === config.tag.taxonomy) {
						tags.push(hashKeyword(taxonomyItem["$"]["nicename"]));
					}
				});
				if (config.apiSchema.categories && categories.length !== 0) contentsItem["categories"] = categories;
				if (config.apiSchema.tags && tags.length !== 0) contentsItem["tags"] = tags;
			}

			if (isDraftItem) {
				draftContents.push(contentsItem);
			} else {
				contents.push(contentsItem);
			}

			i++;
		});

		if (config.api) {
			const result = await executePostAPI(config.apiName, contents);
			if (config.draft) {
				const resultDraft = await executePostAPI(config.apiName, draftContents, true);
			}
			// console.log("result:", result);
			console.log("コンテンツの登録処理が完了しました。");
		} else {
			console.log(
				"[Warning] config.apiがfalseのため、コンテンツの登録は行いません。\nAPIに送信されるデータを data/output_contents.json に出力しました。"
			);
			fs.writeFileSync("./data/output_contents.json", JSON.stringify(contents));
		}
	} else {
		console.log("[Warning] config.postTypeに設定された投稿タイプが見つかりませんでした。");
	}
};

migrateWordPress();
