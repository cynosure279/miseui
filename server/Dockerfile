# miseui-server 镜像：跑在「mise 所在的机器/容器」上，供 Web 版远程接入。
FROM rust:1.89-bookworm AS build
WORKDIR /build
COPY . .
RUN cargo build --release

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/*
COPY --from=build /build/target/release/miseui-server /usr/local/bin/miseui-server
EXPOSE 18771
# 把宿主 mise 挂进来：-v /usr/local/bin/mise:/usr/local/bin/mise 或设置 MISEUI_MISE_BIN
CMD ["miseui-server", "--host", "0.0.0.0"]
