# Discovery Service

## Overview

Spring Cloud Netflix Eureka 기반 서비스 디스커버리.
모든 서비스가 Eureka에 등록되며, Gateway가 Eureka를 통해 서비스를 발견한다.

## Module

단일 모듈: `:discovery` (`discovery/`)

## Base Package

`com.kgd.discovery`

## Key Components

| Component | Role |
|-----------|------|
| `DiscoveryApplication` | Eureka Server bootstrap |

## Port

- 내부/외부: 8761

## Build

```bash
./gradlew :discovery:build
```
