# BUILT BY KO — UNSEEN CITY

> I BUILD NEW WAYS TO SEE CITIES.
> 都市の、新しい見方をつくる。

**https://builtbyko.github.io/portforio/**

実在する道路、鉄道、建物、旧河川のデータを重ね、銀座周辺を一つの都市模型として立ち上げるWebGLスタディです。スクロールに合わせて、暗闇から点、線、建物へと都市が形になります。

関連: [TimeWalk 銀座 — 消えた川の上を、歩く](https://builtbyko.github.io/timewalk/)

## 手元で動かす

```bash
python tools/serve_lab.py
```

起動するとPC用とスマートフォン用のURLが表示されます。`file://` ではES modulesとデータfetchが動作しません。

検証用のクエリ:

- `?debug=1` — 読込状態、品質tier、進捗、draw call、triangle数を表示
- `?quality=high` / `medium` / `low` — 自動判定を一時的に上書き

## 現在の状態

構想していた9段階すべてを実装しています。

| 段階 | 内容 |
|---|---|
| 1 | 暗闇。知覚限界の点だけ |
| 2 | 道路・鉄道・旧河川の頂点1,085点が中心から外へ現れる |
| 3 | 点が線へ接続し、道路・鉄道・旧河川が分かれる |
| 4 | 建物2,530件が中心から外への波で立ち上がる |
| 5 | 側面へ回り込み、地表が厚みを持つと分かる |
| 6 | 現在の地表・鉄道・旧河川が層として分離する |
| 7 | 地表が割れ、隙間から下層が見える |
| 8 | 地表の下へ入り、旧河川の痕跡だけが残る |
| 9 | TimeWalk への入口 |

段階6が、この作品が言いたいことです。都市は一つの面ではなく、同じ場所に別の時間が積み重なっている、ということ。

## 事実として示していないもの

**層の間隔は表示用であり、深度ではありません。** 旧河川がどれだけ下にあるかを示してはいません。

**段階8は実在する地下河川ではありません。** 旧河川の推定線形を「都市の下」という位置に置いた解釈です。断面も水面も作っておらず、見えているのは推定線形そのものです。河道幅を主張しないため、線の太さを演出のために広げてもいません。この注記は降下中ずっと画面に出ます。

## 音

画面下の `Sound` で入ります。既定はoffです。

**すべてWeb Audioの合成音で、録音は使っていません。** 銀座のフィールド録音を持っていないため、録音のふりをすることは避けました。低いドローンをローパスに通し、都市が立ち上がるとフィルターが開き、地下へ入ると閉じます。降下中だけ帯域ノイズが薄く重なります。

実機での連続スクロール時の発熱は未確認です。

## 構成

公開されるのは `docs/` です。GitHub Pages のソースが `main / docs` に設定されています。

```text
docs/                 ← Pagesが配信する範囲
  index.html          Canvas host、loading、fallback
  styles.css          全画面layout、最小UI
  js/
    app.js            Renderer／Scene lifecycle、resize、dispose
    config.js         bbox、色、露出、霧、light、camera、進行の配分
    sequence.js       進捗0〜1を各層の状態へ写す純関数
    scroll.js         scroll量を進捗へ
    city.js           道路、鉄道、旧河川、建物、点の生成
    camera.js         PC／mobileの固定camera
    quality.js        PC／mobile判定
    assets.js         load、error、abort、fallback
    geo.js            局所メートル座標
    ui.js             loading、debug、fallback、scroll合図
  vendor/             Three.js r185
  data/               表示用の派生GeoJSONとmanifest
  .nojekyll           Jekyllの前処理を止める
tools/                ← 公開されない
  serve_lab.py        開発用サーバー
  prepare_city_data.py  データ再生成
```

npm、bundler、build stepはありません。native ES modulesで動きます。

## データ

出典、精度、ライセンスは [docs/DATA_SOURCES.md](docs/DATA_SOURCES.md) と `docs/data/manifest.json` を参照してください。

- 道路・建物・鉄道: OpenStreetMap（ODbL 1.0）
- 旧河川: 手動トレースの**参考線形**。公式境界でも正確な流路でも深度でもありません

建物高さは実値、OSM階数からの換算、表示用の補完値が混在しており、`height_basis` で区別できます。事実として高さを比較する用途には使えません。

`tools/prepare_city_data.py` は元の作業リポジトリの階層を前提に書かれており、このリポジトリ単体では鉄道cacheのパスが解決しません。データの作られ方の記録として置いています。

## ライセンス

コードの扱いは未定です。`data/` 以下のOpenStreetMap由来データはODbL 1.0で提供されます。
