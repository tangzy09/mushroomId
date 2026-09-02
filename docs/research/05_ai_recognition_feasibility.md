# R5 · 「拍照识蘑菇」技术可行性评估（mushroomId）

> 评估对象：纯前端、零依赖、无后端、nginx 静态站的蘑菇图鉴收集游戏（架构同 fishid.ai-speeds.com：原生 HTML/CSS/JS + localStorage）。
> 结论先行：**MVP 不做 AI 识别；V2 做纯前端形态检索表 + 拍照打卡日记；V3 才考虑离线 TF.js/ONNX 小模型，且只输出「相似度参考 top-5」并强制免责。** 依据见各节，未核实处已标注。
> 调研日期：2026-09-02。

---

## 0. 一句话结论

| 问题 | 结论 |
|---|---|
| 技术上能否在零构建、静态站里跑浏览器端识图？ | **能**。TF.js / ONNX Runtime Web 都有 UMD 包可从 jsdelivr/cdnjs 直接 `<script>` 加载；Transformers.js 只需 `<script type="module">` ESM import，同样不需要打包器。 |
| 有没有现成、可商用、能塞进 ≤10MB 的蘑菇模型？ | **没有现成的**。最好的公开数据集/权重（DF20、FGVCx 2018、FungiTastic/BVRA）全部是**非商用研究许可**；Kaggle 小数据集质量/许可参差。要自己训练需自建可商用数据集，成本高。 |
| 云端 API 能不能用？ | 能用但违背「无后端」：必须加一个最小代理（Cloudflare Worker 免费额度足够）。Kindwise mushroom.id 约 €0.01–0.05/次；Claude 视觉约 $0.002–0.01/张（视模型）。 |
| 安全上该不该做？ | 已有临床毒理学研究显示主流识菌 App 在中毒病例标本上准确率仅约 50%；澳大利亚、美国 Public Citizen、中国云南/四川官方都发出警告，且 2024–2026 有多起「AI 说可食→吃了毒鹅膏/毒红菇」案例。**产品上绝不能输出可食性结论**。 |
| 不做 AI 有没有替代？ | 有，而且更契合「图鉴收集游戏」：形态特征多选检索表（multi-access key）、与图鉴对比、拍照打卡日记（EXIF 时间/地点 + localStorage）。纯 JS 可做，5–12 人日。 |

---

## 1. 浏览器端推理方案对比（2025–2026 现状）

### 1.1 运行时对比

| 方案 | 后端 | 加载方式（是否冲突「零构建」） | 运行时体积（估） | iOS Safari | 微信内置浏览器 | 备注 |
|---|---|---|---|---|---|---|
| **TensorFlow.js** | WebGL（默认）/ WASM / WebGPU（独立包） | UMD，`<script src="https://cdn.jsdelivr.net/npm/@tensorflow/tfjs">` + `tfjs-backend-wasm/dist/tf-backend-wasm.js`；wasm 二进制从 jsdelivr 加载无需 CORS 配置（官方 README）。**不冲突**。 | tf.min.js 约 1–1.5MB（未核实精确值） | WebGL 稳定；WASM 多线程在 iOS Safari 初始化曾失败（issue #7540），需关多线程；WebGPU 需 iOS 26 | Android XWeb（Chromium 138 内核）WebGL/WASM 可用；iOS 走 WKWebView，WebGL 可用 | 官方 blog：WebGPU 后端比 WebGL 快约 3×。模型格式为 tfjs graph/layers model（.json + 分片 .bin），转换需 Python `tensorflowjs_converter`（离线一次性，不影响运行时零构建） |
| **ONNX Runtime Web** | WASM（SIMD/多线程）/ WebGL（弃用中）/ WebGPU / WebNN（实验） | UMD，`<script src="https://cdnjs.cloudflare.com/ajax/libs/onnxruntime-web/1.24.1/ort.min.js">`（cdnjs 有 1.24.1）或 jsdelivr `dist/ort.min.js`；`ort.env.wasm.wasmPaths` 可指向 CDN。**不冲突**。 | ort.min.js 数百 KB + wasm 约 10–20MB（jsep/WebGPU 版更大；精确值未核实） | WASM 稳定；WebGPU 需 Safari 26 | 同上 | 官方文档：WebGPU EP 仍标「experimental」；WebNN 也是实验特性。生态最通用（PyTorch → ONNX 一步导出） |
| **Transformers.js v3** | 底层就是 ONNX Runtime Web（WASM/WebGPU） | ESM：`<script type="module">import {pipeline} from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@x.y.z'</script>`。**不冲突**（原生浏览器 ESM，无需打包）。 | 库本身较大；示例 MobileNetV4-conv-small 分类模型 <20MB | **v3 在 iOS 上有崩溃/内存暴涨记录**（issue #1242，2025-03，截至抓取仍 open；workaround 是退回 v2.15.1） | 同 ORT | 好处是模型直接从 HF Hub 拉；坏处是国内访问 HF 不稳定，且需要自己托管模型时反而要配 `env.localModelPath` |
| **WebNN** | 原生 NPU/GPU（CoreML/DirectML/TFLite） | — | — | 未 ship | 未 ship | Chrome 146–149 仅 Origin Trial，W3C 2026-01 CR；业内估计 2027 才可作默认路径。**现在不要依赖**。 |

来源：
- TF.js 平台文档 https://www.tensorflow.org/js/guide/platform_environment
- TF.js WASM 后端 README（CDN 用法、setWasmPaths、CORS 说明）https://github.com/tensorflow/tfjs/blob/master/tfjs-backend-wasm/README.md
- iOS Safari WASM 多线程初始化失败 https://github.com/tensorflow/tfjs/issues/7540
- ORT Web script-tag 示例 https://github.com/microsoft/onnxruntime-inference-examples/blob/main/js/quick-start_onnxruntime-web-script-tag/index.html
- ORT Web 部署（wasmPaths 指向 CDN）https://onnxruntime.ai/docs/tutorials/web/deploy.html
- ORT WebGPU EP（experimental）https://onnxruntime.ai/docs/tutorials/web/ep-webgpu.html
- cdnjs onnxruntime-web 1.24.1 https://cdnjs.com/libraries/onnxruntime-web
- Transformers.js v3 发布说明（WebGPU、MobileNetV4 示例）https://github.com/huggingface/transformers.js/releases/tag/3.0.0
- Transformers.js WebGPU 指南 https://huggingface.co/docs/transformers.js/guides/webgpu
- Transformers.js iOS 崩溃 issue https://github.com/huggingface/transformers.js/issues/1242
- WebNN 状态（Chrome 146 OT）https://www.phoronix.com/news/Chrome-146-Beta ；2026 前沿 Web API 综述 https://www.utsubo.com/blog/frontier-web-apis-2026-production-ready

### 1.2 WebGPU / WASM 可用性（重点：iOS + 微信）

- **iOS Safari**：WebGPU 随 Safari 26 / iOS 26 正式发布（2025 秋），旧系统无。→ 2026 年用户中仍有相当比例 iOS ≤18，**必须以 WASM 或 WebGL 为保底**。
  https://webkit.org/blog/17333/webkit-features-in-safari-26-0/ ；https://appdevelopermagazine.com/webgpu-in-ios-26/
- **WKWebView（所有 iOS 内置浏览器，含微信 iOS）**：有资料称 WKWebView / Android WebView 默认**不开启** WebGPU，混合应用仍需 WebGL 回退。→ **微信 iOS 端按「无 WebGPU」设计**（未在微信实机核实）。
  https://www.testmuai.com/learning-hub/webgpu-browser-support/
- **微信 Android（XWeb）**：现网内核 Chromium 138，开发版 142（微信官方公告）。Chromium 121+ 在 Android 已 ship WebGPU，但 XWeb 是否放开 `navigator.gpu` **未核实**；社区资料称微信 H5 目前用 WebGL2 并建议运行时探测 `navigator.gpu` 再回退。
  https://developers.weixin.qq.com/community/develop/doc/000a8edc1502708b1624a3c6a6b001
- **WASM**：iOS JavaScriptCore 与 Android V8 均支持（腾讯云文章），WASM 是**唯一可以在全部目标端跑通的后端**。但要注意：WASM SIMD + 多线程需要 `SharedArrayBuffer`，静态站需要 nginx 加 `Cross-Origin-Opener-Policy: same-origin` + `Cross-Origin-Embedder-Policy: require-corp`，这会**破坏跨域加载 CDN 脚本/图片**（除非 CDN 资源带 CORP 头，jsdelivr 有）。实践上建议**单线程 SIMD WASM** 避免 COOP/COEP 改造。
  https://cloud.tencent.com/developer/article/1634652
- **移动端内存**：Safari Metal 后端对 GPU buffer 有硬限制（旧机 256MB），Chrome 的 `maxStorageBufferBindingSize` 常被限到 128MB；4GB RAM 机器上大模型很快撞墙。对我们意义：**模型必须 ≤10MB（int8/fp16），输入 224px，一次只跑单张**。
  https://medium.com/@marcelo.emmerich/webgpu-bugs-are-holding-back-the-browser-ai-revolution-27d5f8c1dfca

### 1.3 候选骨干网络（移动端）

| 骨干 | 参数量 | ImageNet top-1 | 估算权重体积 | 说明 |
|---|---|---|---|---|
| MobileNetV3-Small | 2.5M | 64.9% | fp32 ≈10MB / int8 ≈2.5MB | 最小；fine-grained 精度偏弱 |
| MobileNetV4-Conv-Small | 3.8M | 73.8%（224px, timm） | fp16 ≈7.6MB / int8 ≈4MB | Transformers.js 官方示例即此模型，ONNX 就绪 |
| EfficientNet-Lite0 | 4.7M | 75.1%（int8 74.4%） | int8 ≈5MB | 官方给了 INT8 TFLite，量化损失 <1pt |
| EfficientNet-Lite2/3 | 6.1M / 8.2M | 77.6% / 79.8% | int8 ≈6–9MB | 10MB 上限内精度最高的选择 |
| ViT-Tiny / ConvNeXt-Tiny | 5.7M / 28M | — | ConvNeXt-T fp16 ≈56MB | ConvNeXt-Tiny **超预算**；ViT-Tiny 可但小数据上不如 CNN |

来源：EfficientNet-Lite 官方表 https://github.com/tensorflow/tpu/blob/master/models/official/efficientnet/lite/README.md ；MobileNetV4 timm 卡 https://huggingface.co/timm/mobilenetv4_conv_small.e2400_r224_in1k ；MobileNetV3 论文 https://arxiv.org/pdf/1905.02244

**首次加载时间估算**（4G 网 5MB/s，含 CDN 冷启）：ORT wasm 10–20MB + 模型 5–8MB ≈ **3–6 秒**；TF.js WASM 后端（约 3–4MB wasm）+ 模型 ≈ 2–4 秒。都需要：懒加载（只在用户点「识别」时拉）、`Cache-Control: max-age=30d` 长缓存（nginx 已有此策略）、加载进度 UI。**国内用户访问 jsdelivr/cdnjs 时好时坏**，建议把 wasm 和模型文件自托管到 nginx，仅 JS 主包走 CDN——这仍然不需要构建工具。

### 1.4 与「零构建工具」约束的关系

不冲突。运行时零构建；**模型训练/转换是离线一次性工作**（Python：PyTorch→ONNX，或 Keras→tfjs_converter），产物是静态文件，和现在 `process_cute_batch.py` 生成 webp 的性质一样。唯一新增：`assets/model/` 目录（≤10MB）+ 一个 `js/classify.js`。

---

## 2. 现成蘑菇分类模型与数据集

| 数据集 / 权重 | 规模 | 报告精度 | 许可 | 能否商用 | 能否蒸馏到 ≤10MB |
|---|---|---|---|---|---|
| **FGVCx Fungi 2018**（Kaggle / Danish Svampe Atlas） | 1,394 种；85,578 训练 + 4,182 验证 + 9,758 测试 | 竞赛 top-1 未列（原文 WACV2020 Sulc 等报告较高） | Svampe Atlas ToS：**仅限非商业研究/教育**，禁止再分发图片 | ❌ | 技术可，许可不可 |
| **Danish Fungi 2020 (DF20)** | 295,938 张 / 1,604 种；DF20-Mini 36,393 张 / 182 种 | ViT 80.45%（论文）；DF24 版：ViT-L/16@384 top-1 78.8% / top-3 90.6%；EfficientNet-B5@299 63.3% / 81.3% | GitHub 明示 BSD 代码许可但「训练数据、元数据、**模型**仅限非商业研究」 | ❌（含 HF 上的 BVRA 权重） | 同上 |
| **FungiTastic / FungiCLEF 2024–2025** | ≈350k 观测、≈5k 种，多模态（元数据、卫星、天气、分割 mask） | FungiCLEF 2025（few-shot 稀有种赛道）冠军 top-5 仅 78.9%；BEiT-Base 为闭集最佳 | 代码 BSD-3；数据许可页面未明示（未核实，同源 Atlas 推测为非商用） | ❌/未核实 | 同上 |
| **MO106**（Pannon 大学） | 106 种 / 29,114 张，源自 FGVCx + Mushroom Observer 清洗 | 论文 CNN 研究用 | Mushroom Observer 图片各自 CC 许可不一（含 NC）；数据集页未明示商用 | ⚠️ 需逐图核 | 可 |
| **iNaturalist 公开小模型** | ≈500 分类单元（跨所有生物），**不是**蘑菇专用 | — | 代码 MIT；**完整物种模型不公开**（版权/ARR 照片） | 代码可，模型无用 | — |
| **Kaggle 小数据集**（如 "Common genus's images" 9 属 6.7k 张；"215 种 3,122 张"；"100 种俄罗斯 5 万张"） | 小而杂 | 项目级 90%+（类少所以高，不代表真实场景） | 多数注明「需遵守 Mushroom World 等原站许可」 | ⚠️ 大多不可 | 可 |
| **Hugging Face 社区权重**（kyvu/mushroom-classification、dima806/mushrooms_image_detection 等，共约 16 个 tag=mushroom） | 多为 Kaggle 小集微调 ViT/ResNet | 卡片自报 | 权重多标 Apache/MIT，但训练数据许可继承问题未解 | ⚠️ | 可，但精度不可信 |
| **Kindwise mushroom.id（闭源 API）** | 3,100 种 | 自报 top-3 88%（内部验证集） | 商业 API | ✅（付费） | 不可（云端） |
| **中科院昆明植物所「真菌王国」数据库**（2026-05-29 开放） | 西南大型真菌 8,648 条标本+DNA、2.8 万张子实体照片；423 个三维模型/182 种 | 非识别模型，是检索数据库 | 免费开放；是否允许 AI 训练/商用**未核实** | 未核实 | — 但**对中国用户最有价值的图片/名录来源**，值得联系授权 |

来源：
- FGVCx 2018 https://github.com/visipedia/fgvcx_fungi_comp ；Kaggle https://www.kaggle.com/c/fungi-challenge-fgvc-2018
- DF20 GitHub（许可 + DF24 精度表）https://github.com/BohemianVRA/DanishFungiDataset ；论文 https://arxiv.org/abs/2103.10107 ；WACV 版 https://openaccess.thecvf.com/content/WACV2022/html/Picek_Danish_Fungi_2020_-_Not_Just_Another_Image_Recognition_Dataset_WACV_2022_paper.html
- FungiTastic https://github.com/bohemianvra/FungiTastic/ ；论文 https://arxiv.org/abs/2408.13632 ；HF 权重 https://huggingface.co/BVRA/beit_base_patch16_224.in1k_ft_fungitastic_224
- FungiCLEF 2025 综述 https://www.dei.unipd.it/~faggioli/temp/clef2025/paper_233.pdf ；LifeCLEF 2025 https://www.imageclef.org/LifeCLEF2025
- MO106 https://keplab.mik.uni-pannon.hu/en/mo106eng
- iNaturalist 模型政策 https://github.com/inaturalist/inatVisionAPI ；https://github.com/inaturalist/model-files ；论坛 https://forum.inaturalist.org/t/hidden-computer-vision-api/41775
- Kaggle 数据集 https://www.kaggle.com/datasets/maysee/mushrooms-classification-common-genuss-images ；https://www.kaggle.com/datasets/daniilonishchenko/mushrooms-images-classification-215
- HF 社区 https://huggingface.co/models?other=mushroom
- Kindwise 发布 https://www.kindwise.com/post/production-release-insect-id-mushroom-id
- 中科院数据库 https://www.news.cn/20260529/a08e5998a9f14a61a57a5097838b8393/c.html ；http://health.people.com.cn/n1/2026/0615/c14739-40740447.html

**蒸馏可行性判断**：技术上完全可行——用 BEiT/ViT-L 教师在 DF20/FungiTastic 上蒸馏 EfficientNet-Lite2 学生，限定到本项目图鉴的 ~200–300 种（而非 1,604 种），int8 后 5–8MB。文献里 fine-grained 蒸馏后 MobileNetV2 在 CUB-200 可到 76.5%（PAND, 2026）。但**许可链条断在数据上**：DF20/FGVCx/FungiTastic 的教师模型和数据都是非商用，蒸馏出的学生模型仍是衍生品，站点有广告/打赏即属灰区。

**中国场景额外问题**：上述数据集几乎全是欧洲（丹麦）物种分布，与云南/东北常见种（见手青、鸡枞、松茸、白毒伞、亚稀褶红菇…）重叠有限。即使许可没问题，**对国内用户的实际精度会明显低于论文数字**。

---

## 3. 云端 API 方案与「最小后端」

### 3.1 API 对比（每千次估算，2025–2026 公开价）

| 服务 | 能力 | 每千次费用估算 | 备注 |
|---|---|---|---|
| **Kindwise mushroom.id** | 3,100 种，返回相似图、概率、部分可食性/毒性字段 | **€10–50 / 千次**（€0.01–0.05/credit，随量降）；注册送 100 免费 credit | 唯一「蘑菇专用、可商用」的现成方案；自报 top-3 88%，**无独立第三方评测**（未核实精度） |
| **iNaturalist CV API** | — | — | **不对外开放**；只放出约 500 分类单元小模型（非蘑菇专用） |
| **Google Cloud Vision（Label Detection）** | 通用标签，只能到「mushroom / fungus」粒度 | $1.50/千次（>5M 后 $0.60），首 1,000/月免费 | **不能识种**，无价值 |
| **Vertex AI AutoML 自训分类** | 自建模型 | 训练 $3.465/h；在线预测节点 $1.375–2.0/h（≈**$1,000+/月常驻**）或批量 | 计时计费，对低流量业余项目**极不划算**；且训练数据许可问题同第 2 节 |
| **Roboflow Serverless** | 自训模型托管 | 免费 Public 计划 $60 credit/月；典型推理 ≈0.2 credit/千张（冷启 2.2）；付费 $4/credit | 对小流量几乎免费；但模型仍要自己训练 |
| **Claude 视觉（多模态直接识图）** | 通用 LLM，能给出属/种猜测 + 解释 | 图片 token ≈ w×h/750（1000×1000 ≈ 1,334 tok；上限 1,568px 长边）。以 1,400 输入 + 300 输出 token 计：Haiku 4.5（$1/$5 per MTok）≈ **$2.9/千次**；Sonnet 5（$2/$10）≈ **$5.8/千次**；Opus 5（$5/$25）≈ **$14.5/千次** | 精度：无同行评审研究；一篇 2024 博客用 4 张「小棕菇」测 GPT-4o，3/4 属级一致但**捏造了照片里看不到的菌褶描述**——典型幻觉风险。LLM 适合「解释形态特征」，**不适合作为识别器** |
| **GPT/Gemini 多模态** | 同上 | 量级相近（未核实当前价） | 同上 |

来源：
- Kindwise 定价/FAQ https://www.kindwise.com/pricing ；https://www.kindwise.com/faq ；产品页 https://www.kindwise.com/mushroom-id
- iNaturalist 开发者页 https://www.inaturalist.org/pages/developers
- Cloud Vision 定价 https://cloud.google.com/vision/pricing ；Vertex AI 定价 https://cloud.google.com/vertex-ai/pricing
- Roboflow 定价 https://docs.roboflow.com/deployment/roboflow-cloud/serverless-api/pricing
- Claude 视觉 token 公式 https://platform.claude.com/docs/en/build-with-claude/vision ；模型价格来自本会话 claude-api skill 缓存表（2026-06）
- GPT-4o 识菌博客 https://medium.com/@miini.teng/can-chatgpt-correctly-identify-mushrooms-d1e58b664b26

### 3.2 「无后端」约束下的最小代理

前端直连任何付费 API 都会把 key 暴露在 JS 里（被人扒走刷额度）。最小代理方案：

| 方案 | 免费额度 | 超出价 | 复杂度 |
|---|---|---|---|
| **Cloudflare Worker**（推荐） | 100,000 请求/天，10ms CPU/次 | $5/月含 1,000 万次；之后 $0.30/百万 | 1 个 `worker.js`（约 40 行）：校验 Origin/Referer → 限流（KV 或 Turnstile）→ 转发到 Kindwise/Claude → 剥离敏感字段 → 返回。**部署用 wrangler CLI 或网页粘贴，不需要在项目里引入构建工具**。 |
| **AWS Lambda Function URL** | 100 万次/月 + 40 万 GB-s（永久） | $0.20/百万 | 类似，但已有 EC2 的话也可直接在 nginx 同机跑一个 Python/Node 小进程反代（最简单，但破坏「纯静态」部署流程） |

来源：https://developers.cloudflare.com/workers/platform/pricing/ ；https://aws.amazon.com/lambda/pricing/ （搜索摘要，未逐字核实）

**必须解决的非成本问题**：
1. **防刷**：没有账号体系，只能靠 Referer 校验（可伪造）+ 每 IP 限流 + Cloudflare Turnstile；仍会有人写脚本消耗 credit → 预算封顶（Kindwise 预付 credit 天然封顶）。
2. **图片上传**：手机照片 3–5MB，需前端 canvas 压到 ≤1,024px/≤300KB 再传（省 token / 加快）。
3. **隐私**：EXIF GPS 必须在前端剥离后再上传（canvas 重绘天然去 EXIF）。
4. **法律/免责**：第三方 API 若返回「edible」字段，**前端必须丢弃**，不得展示（见第 4 节）。

**判断**：如果一定要 AI，「Cloudflare Worker + Kindwise」是成本最低、精度最靠谱的组合（月 1 万次识别 ≈ €100–500）；但它把项目从「纯静态」变成「静态 + 一个 Worker + 一个付费 API 账户」，与项目定位有偏差。

---

## 4. 安全与责任

### 4.1 证据：AI 识菌准确率与已发生的伤害

- **临床毒理学研究（Clinical Toxicology 2023, 61(3)）**：澳大利亚毒物中心团队用真实中毒病例的标本照片测试 Picture Mushroom、Mushroom Identificator、iNaturalist 三款 App，综合正确率约 **50%**，最好的一款 **49%**（按检索摘要；各 App 具体数字未核实原文），且存在**把有毒种判为可食**的情况；结论：目前不足以单独用于排除中毒风险。
  https://www.tandfonline.com/doi/full/10.1080/15563650.2022.2162917 ；PubMed https://pubmed.ncbi.nlm.nih.gov/36794335/
- **Public Citizen《Mushrooming Risk》报告（2024-03-18）**：AI 识别 App 已导致采食者住院；生成式 AI 还在 Amazon 上产出错误的采菌指南。指出 App 无法考虑基质、伤变色、气味等关键特征。
  https://www.citizen.org/article/mushroom-risk-ai-app-misinformation/ ；PDF https://www.citizen.org/wp-content/uploads/ai-mushroom-apps-risk-misinformation-report-2024.pdf ；OECD.AI 事件库 https://oecd.ai/en/incidents/2024-04-03-c733
- **澳大利亚**：维州毒物中心 2025 年接到 436 起蘑菇暴露来电；食品安全机构与地方媒体明确「不要用 AI App 识菌」；Leongatha 死帽菇案（2023 事件，2025 判决）让公众关注度极高。
  https://aapnews.aap.com.au/news/fatal-fungi-health-alert-as-mushroom-season-begins ；https://www.sgst.com.au/mushroom-foragers-warned-against-using-ai-apps-for-identification/ ；https://www.foodsafety.asn.au/topic/deadly-deathcap-mushroom-warning-issued-as-autumn-kicks-in-17-march-2025/
- **中国**：
  - 2024-04 报道：用 AI 软件识别后误食**毒鹅膏**险些丧命。https://finance.sina.com.cn/wm/2024-04-14/doc-inaruvkw3706642.shtml
  - 云南「用 AI 找菌子」现象报道（澎湃）。https://m.thepaper.cn/newsDetail_forward_33497906
  - 2026-07 四川甘孜：游客采 10 余斤野生菌逐一 AI 识别判「安全」，事后挑出 8 斤毒菌，含被 AI 标为「可食用红菇」的剧毒种；官方随后把「AI 识别」列为高风险行为。https://k.sina.com.cn/article_7879996351_1d5af33bf06802jppm.html ；https://news.qq.com/rain/a/20260723A0B5ZT00
  - 专家原话：「鸡枞与白毒伞外形高度相似」「剧毒红菇与可食红菇几乎无差别」「唯一值得信赖的识别方法就是不吃不认识的菌子」。
- **行业侧**：Kindwise 自身也把 mushroom.id 定位为「参考」而非食用建议（未核实其条款原文）。

### 4.2 产品上必须的限制（无论 V3 是否上 AI，先写进 PRD）

1. **永不输出可食性结论**。识别结果只有「视觉相似度参考 top-5 + 置信度条」，UI 文案统一为「可能相似的种」，禁止出现「可食」「安全」「无毒」字样；若使用第三方 API，前端丢弃 edibility 字段。
2. **识别只服务游戏循环**：结果用于「解锁图鉴条目 / 打卡加经验 / 触发答题」，不是鉴定工具。解锁逻辑建议：识别 top-5 → 用户从中**手动选择**「我觉得是这一个」→ 才计入图鉴（人在回路，也降低误解锁）。
3. **剧毒相似种强制拦截弹窗**：为图鉴每个种维护 `dangerLookalikes: [id...]`；只要 top-5 中含任一 `toxicity: 'deadly'` 种（鹅膏属、亚稀褶红菇、肉褐鳞环柄菇、毒沟褶菌等），先弹全屏红色警告（不可跳过 3 秒），内容：「此结果包含剧毒相似种，本功能不能区分它们，任何情况下请勿食用野生菌」。
4. **首次使用一次性免责协议**（存 localStorage 标记），并在每次结果页底部固定免责短句 + 12320 卫生热线/当地毒物中心提示。
5. **不做「离线鉴定」宣传**：站点 meta/分享卡片不得出现「识别蘑菇」「一拍即知」等 SEO 词，改用「蘑菇图鉴收集游戏」。
6. **对低置信度直接不给结果**：top-1 < 0.35（阈值需按验证集调）显示「看不清/不像图鉴里的种」，而不是硬给 5 个候选。
7. **记录本地日志**：把识别结果、用户选择存 localStorage，方便用户事后自查，不上传。

---

## 5. 不做 AI 识别的替代方案（推荐先做）

### 5.1 形态特征「检索表向导」（multi-access key，纯 JS）

- **形式**：不是二叉检索表（dichotomous），而是**多入口检索**（用户任选特征、任意顺序填）：菌盖颜色 / 直径 / 形状 / 表面（黏、鳞片）→ 菌褶（有/无、颜色、离生/延生）或菌管 / 菌孔 → 菌柄（有无、有无菌环、有无菌托、基部膨大）→ 孢子印颜色 → 基质（地上/木上/粪上）→ 季节 / 区域 → 伤变色 / 气味。每一步实时显示「剩余候选 N 种」+ Q 版缩略图网格。
- **先例**：MycoKey（1,100 属图形检索，已停更）、Lucid（商业、JS 播放器）、Xper3（CC BY-NC-SA）——都证明这条路可行，但没有可直接复用的开源 JS 引擎，**自己写反而简单**：数据是每种一行的特征向量（JSON 字段加在现有 `MUSHROOM_DATA` 上），引擎是一个 30 行的过滤器 + 「下一步最能区分候选的特征」贪心排序（信息增益）。
  http://mycokey.com/ ；https://www.lucidcentral.org/ ；https://app.xper3.fr/ ；https://en.wikipedia.org/wiki/Multi-access_key
- **成本**：引擎 1–2 人日；**数据标注是大头**——每种 12–15 个特征 × 200–300 种，参考《中国大型菌物资源图鉴》/ 中科院数据库，约 4–6 人日（可用 LLM 预填 + 人工核对，和现有「60-agent 事实核查」流程一致）；UI 2–3 人日。合计 **7–11 人日**。
- **用户价值**：高。它本身就是教学内容（玩家学会「看菌托、看孢子印」），天然带出「为什么剧毒鹅膏有菌托」这类安全知识；每次筛完给 3–8 个候选让玩家去答题/对比，直接喂现有答题→抽卡循环。
- **风险**：同样不能出可食结论；特征表要标注「需要切开/等待孢子印」的操作提示；用词需与图鉴 `fact` 字段一致。

### 5.2 「与图鉴对比」模式

- 用户上传/拍照 → 页面左右分屏：左边自己的照片（canvas 本地渲染，不上传），右边可滑动的图鉴真实照片；支持按检索表结果或按稀有度筛选；点「就是它」→ 打卡入图鉴（人在回路）。
- **成本**：2–3 人日（复用 `photo_picker.html` 的对比思路和现有 real/ 图库）。
- **价值**：中高；零风险；是 5.1 和 5.3 的粘合层。

### 5.3 「拍照打卡进图鉴日记」（社交/记录）

- **功能**：拍照 → 前端读 EXIF（时间、GPS）→ 缩略图（≤512px webp，canvas）+ 元数据存 localStorage/IndexedDB → 生成「今日打卡卡片」（复用 `ShareUtils` 2× DPR canvas）→ 分享；日记按日期/地点聚合，形成个人「菌季地图」。
- **技术要点**：
  - EXIF 解析用 exif-js（cdnjs 有）或自写 30 行 JPEG APP1 解析；**iOS 用 `<input capture>` 直接拍照时 EXIF 会被剥掉**，从相册选已有照片则保留（WebKit bug 207088）；HEIC 经浏览器会转 JPG 且可能丢 EXIF。→ 设计上：EXIF 缺失时让用户手填地点/时间，GPS 只保留到 0.01° 精度并**只存本地**。https://bugs.webkit.org/show_bug.cgi?id=207088
  - 存储：localStorage 5MB 上限，缩略图应存 IndexedDB（原生 API，仍零依赖）；纳入 `SaveTransfer` 导出。
  - 与现有 `SaveTransfer`/里程碑体系天然衔接（「打卡 10 次」成就）。
- **成本**：3–5 人日。
- **价值**：中高。这是把「拍照」这个用户强需求转化成**零责任**的玩法；也为未来（若真做 V3）积累用户自愿标注的本地样本（仍不上传）。

### 5.4 三者组合的用户流程

拍照 → 打卡日记（存本地）→ 「想知道它像谁？」→ 检索表向导（填 3–5 个特征）→ 候选 3–8 种 → 与图鉴对比 → 玩家自己勾选「我觉得是 X」→ 解锁/答题。整条链没有任何自动判断，责任清晰。

---

## 6. 推荐路线图

| 阶段 | 内容 | 体量（人日） | 技术风险 | 责任风险 |
|---|---|---|---|---|
| **MVP（不做 AI）** | 图鉴 + 答题 + 抽卡（复刻 fishId 架构）；数据层预留 `toxicity`、`dangerLookalikes`、`features` 字段；全站免责文案与「不提供食用建议」声明；分享卡片模板不含「识别」措辞 | 数据迁移 3–5（不含蘑菇数据采集本身）；UI 复用 | 低 | 低——前提是文案审过 |
| **V2（检索表 + 打卡）** | 5.1 多入口检索表引擎 + 特征标注；5.2 对比模式；5.3 打卡日记（EXIF/IndexedDB/分享卡）；剧毒相似种弹窗组件（V3 也复用） | 检索表 7–11；对比 2–3；打卡 3–5；弹窗 1 → **13–20** | 中低：iOS EXIF 剥离、IndexedDB 容量、特征数据一致性 | 低：无自动判断 |
| **V3（可选，离线小模型）** | 前置条件：①拿到可商用训练数据（自采/中科院授权/CC-BY 图片人工筛）②验证集上 top-5 ≥ 85%（本站图鉴种范围内）；实现：ORT Web WASM 单线程 SIMD（UMD 自 cdnjs）+ 自托管 EfficientNet-Lite2 int8 ONNX（≤8MB）+ 224px 前处理 + top-5「相似参考」+ 低置信度拒答 + 强制剧毒弹窗 + 一次性免责；懒加载与进度条；WebGPU 仅作可选加速（探测 `navigator.gpu`），微信 iOS 默认走 WASM | 数据集构建 15–30（最大头，且高度不确定）；训练/蒸馏/量化 5–8；前端集成 4–6；实机（iOS 15–26 / 微信 Android+iOS / 低端安卓）测试 3–5 → **27–49** | 高：数据许可；国内 CDN 可达性；iOS 内存/崩溃（Transformers.js 已有先例，选 ORT 直连更稳）；模型 5–8MB 首载体验；微信 WKWebView 无 WebGPU | 中：即使做了全部限制，仍会有用户把「相似」当「就是」。需接受这一点或永远停在 V2 |
| **V3 备选（云端）** | Cloudflare Worker + Kindwise mushroom.id；同样只展示相似 top-5、剥掉 edibility；预付 credit 封顶 | 3–5 人日 + 月费 €100–500/万次 | 中：防刷、国内访问 Cloudflare/Kindwise 的可达性未核实 | 同上 |

**为什么把 AI 放到最后且可选**：
1. 精度证据不支持（真实中毒标本上 ≈50%；FungiCLEF 少样本赛道 top-5 78.9%；国内物种更差）。
2. 可用权重与数据全部非商用，自建数据成本（15–30 人日）远超整个 V2。
3. 责任不对称：图鉴游戏的收益是「好玩」，AI 误判的代价是人命；V2 的三件替代品已经吃掉了「拍照」这个需求的大部分价值，并把选择权留给人。
4. 零依赖/静态站约束本身不是障碍，但「国内 CDN + iOS/微信 WASM + 10MB 模型」的工程摩擦，对一个业余维护的项目是持续负担。

---

## 附：未核实清单

- Clinical Toxicology 2023 各 App 分项准确率与「毒→可食」误判具体次数（原文被网络拦截，仅有摘要转述）。
- FungiTastic 数据集本身的许可条款原文。
- 微信 Android XWeb 138 是否开放 `navigator.gpu`；微信 iOS WKWebView 在 iOS 26 是否有 WebGPU。
- onnxruntime-web / tfjs 各 dist 文件精确字节数（CDN 页面被拦截；文中为量级估计）。
- Kindwise mushroom.id 的独立第三方精度评测（未找到）；其 API 条款对可食性字段的免责措辞。
- 中科院「真菌王国」数据库是否允许用于模型训练与商用。
- GPT/Gemini 当前视觉定价。
