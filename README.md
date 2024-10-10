# wp2microCMS
WordPressの投稿データをmicroCMSに移行するためのプログラムです。

### 各ディレクトリの役割

`/data/`：WordPressのエクスポートファイル（XML形式）を設置する

`/data/media/`：WordPressのuploadsフォルダ配下をここに置く

### コマンド
`npm run images`：画像（メディア全て）のアップロード

`npm run start`：投稿タイプ（カテゴリ、タグを含む）の移行

### 使い方
#### 事前準備

1. [WordPress] "ツール" > "エクスポート"画面ですべてのコンテンツをエクスポートする
2. [WordPress] アップロードしたメディア（`wp-content/uploads`フォルダの中身）をダウンロードしておく
3. [microCMS] アカウント登録及び移行先であるサービスを作成しておく
4. [microCMS] "権限管理" > "APIキー管理"画面からコンテンツAPIの「POST」、マネジメントAPIの「メディアのアップロード」をONにする
5. `.env`ファイルにmicroCMSのサービスドメインとAPIキー情報を入力しておく
6. `.env`ファイルにWordPressの`wp-content/uploads`フォルダまでのURLを入力しておく（例: `https://example.com/wp-content/uploads/`）

#### 手順

1. `/data/`フォルダにWordPressのエクスポートファイル（XML形式）を設置する
2. `/data/media/`フォルダにWordPressの`wp-content/uploads`フォルダの中身を設置する
3. `/src/config.js`を確認し、移行する内容に応じた設定を行う
4. `/src/config.js`に記載のAPIスキーマをminroCMSの各コンテンツAPIに設定する *記載以外のスキーマの移行はプログラムの修正が必要となります。
5. `npm run images`を実行する（メディアファイルがmicroCMSにアップロードされていることを確認する）
6. `npm run start`を実行する（投稿タイプの情報がmicroCMSにアップロードされていることを確認する）
7. 他の投稿タイプ（カテゴリ、タグを含む）を移行する場合は、`/src/config.js`を修正し、`npm run start`を実行します

※実際に移行する前に移行するデータを確認したい場合には、`/src/config.js`でapiをfalseで実行することで、移行前のデータ（output.json）を確認することができます。
