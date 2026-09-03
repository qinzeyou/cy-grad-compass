import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { SkillService } from '../skills/skill-service.js';

test('技能服务可以导入、读取和删除技能', () => {
  const root = mkdtempSync(join(tmpdir(), 'skill-service-'));
  const source = join(root, 'source');
  const userData = join(root, 'user-data');
  mkdirSync(source);
  writeFileSync(join(source, 'skill.json'), JSON.stringify({ name: '分页功能', description: '复用分页实现' }));
  writeFileSync(join(source, 'SKILL.md'), '# 分页功能\n\n先检查现有列表。');
  const service = new SkillService(userData);
  try {
    const imported = service.importFrom(source);
    assert.equal(imported.name, '分页功能');
    assert.equal(service.listFeatures()[0]?.name, '分页功能');
    assert.match(service.get(imported.id).instructions, /检查现有列表/);
    assert.equal(readFileSync(join(userData, 'skills', imported.id, 'SKILL.md'), 'utf8').includes('分页'), true);
    service.delete(imported.id);
    assert.throws(() => service.get(imported.id), /技能不存在/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('无 skill.json 的 SKILL.md 目录可按目录名导入并识别功能', () => {
  const root = mkdtempSync(join(tmpdir(), 'skill-service-'));
  const source = join(root, 'caiya-core'); mkdirSync(source); writeFileSync(join(source, 'SKILL.md'), '# Caiya Core');
  const service = new SkillService(join(root, 'user-data'));
  try { const skill = service.importFrom(source); assert.equal(skill.name, 'caiya-core'); assert.equal(service.listFeatures()[0]?.name, 'caiya-core'); } finally { rmSync(root, { recursive: true, force: true }); }
});

test('技能服务按功能展示详情并只逻辑删除当前功能', () => {
  const root = mkdtempSync(join(tmpdir(), 'skill-service-'));
  const source = join(root, 'caiya-core');
  const references = join(source, 'references');
  const userData = join(root, 'user-data');
  mkdirSync(references, { recursive: true });
  writeFileSync(join(source, 'SKILL.md'), '# Caiya Core\n\n按目标项目适配功能。');
  writeFileSync(join(references, 'collaborative-filtering-core.md'), '# 协同过滤核心\n\n采用 ItemCF 生成个性化推荐。');
  writeFileSync(join(references, 'collaborative-filtering-frontend.md'), '# 协同过滤前端适配\n\n展示推荐列表。');
  writeFileSync(join(references, 'ai-assistant-core.md'), '# AI 助手\n\n提供项目问答。');
  const service = new SkillService(userData);

  try {
    const skill = service.importFrom(source);
    const features = service.listFeatures();
    const recommendation = features.find((feature) => feature.name === '协同过滤推荐');
    assert.ok(recommendation);
    assert.equal(recommendation.skillName, 'caiya-core');
    assert.equal(recommendation.source, 'imported');
    assert.equal(features.some((feature) => feature.name === 'AI 助手'), true);

    const detail = service.getFeature(recommendation.id);
    assert.equal(detail.name, '协同过滤推荐');
    assert.match(detail.instructions, /按目标项目适配功能/);
    assert.match(detail.instructions, /采用 ItemCF/);
    assert.match(detail.instructions, /展示推荐列表/);
    assert.doesNotMatch(detail.instructions, /提供项目问答/);

    service.deleteFeature(recommendation.id);
    assert.equal(service.listFeatures().some((feature) => feature.id === recommendation.id), false);
    assert.equal(service.listFeatures().some((feature) => feature.name === 'AI 助手'), true);
    assert.equal(readFileSync(join(userData, 'skills', skill.id, 'SKILL.md'), 'utf8').includes('Caiya Core'), true);
    const metadata = JSON.parse(readFileSync(join(userData, 'skills', skill.id, 'skill.json'), 'utf8')) as { deletedFeatureIds?: string[] };
    assert.deepEqual(metadata.deletedFeatureIds, [recommendation.id]);
    assert.throws(() => service.getFeature(recommendation.id), /功能不存在/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
