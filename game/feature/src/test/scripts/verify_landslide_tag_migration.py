"""Run V109 against an isolated real MySQL 8 fixture. Never connects to production."""
import json
from pathlib import Path
import subprocess
import time
import uuid

ROOT = Path(__file__).resolve().parents[5]
MIGRATIONS = ROOT / 'game/feature/src/main/resources/gamedb/migration'
container = 'landslide-v109-' + uuid.uuid4().hex[:10]

def docker(*args, **kwargs):
    return subprocess.check_output(['docker', *args], text=True, **kwargs)

def sql(statement):
    return docker('exec', '-i', container, 'mysql', '-uroot', '-paudit-fixture-only',
                  '--batch', '--skip-column-names', 'fixture', input=statement,
                  stderr=subprocess.DEVNULL).strip()

try:
    docker('run', '--rm', '-d', '--name', container, '-e', 'MYSQL_ROOT_PASSWORD=audit-fixture-only',
           '-e', 'MYSQL_DATABASE=fixture', 'mysql:8.0')
    for attempt in range(60):
        try:
            sql('SELECT 1;')
            break
        except subprocess.CalledProcessError:
            time.sleep(1)
    else:
        raise AssertionError('isolated MySQL did not become ready')
    schema = (MIGRATIONS / 'V1__init_game_schema.sql').read_text().split('CREATE TABLE game_stats')[0]
    migration = (MIGRATIONS / 'V109__landslide_multiplayer_json_snapshot.sql').read_text()
    for title, tags in [('existing tags', ['versus', 'artillery', 'turn-based', 'physics', 'bot']),
                        ('already present', ['bot', 'multiplayer']), ('empty', []), ('null', None), ('absent game', False)]:
        sql('DROP TABLE IF EXISTS game_tag_map, game_tag, game;' + schema)
        def insert_game(slug, value):
            tags_sql = 'NULL' if value is None else "'" + json.dumps(value) + "'"
            sql("INSERT INTO game(slug,title,description,thumbnail_url,engine_type,load_type,entry_url,orientation,developer_name,status,tags,created_at,updated_at) "
                f"VALUES('{slug}','fixture','','','HTML5','IFRAME','/','LANDSCAPE','fixture','PUBLISHED',{tags_sql},NOW(6),NOW(6));")
        if tags is not False:
            insert_game('landslide', tags)
        insert_game('unrelated', ['bot', 'preserved'])
        sql("INSERT INTO game_tag(slug,name) VALUES('multiplayer','Multiplayer');")
        before_other = sql("SELECT CAST(tags AS CHAR),updated_at FROM game WHERE slug='unrelated';")
        if title == 'existing tags':
            # Reproduce the deployed V108 state: map present, JSON missing.
            sql((MIGRATIONS / 'V108__landslide_multiplayer_tag.sql').read_text())
        sql(migration)
        first = sql('SELECT slug,CAST(tags AS CHAR),updated_at FROM game ORDER BY slug;')
        first_map = sql('SELECT game_id,tag_slug FROM game_tag_map ORDER BY game_id,tag_slug;')
        sql(migration)
        assert sql('SELECT slug,CAST(tags AS CHAR),updated_at FROM game ORDER BY slug;') == first, title
        assert sql('SELECT game_id,tag_slug FROM game_tag_map ORDER BY game_id,tag_slug;') == first_map, title
        assert sql("SELECT CAST(tags AS CHAR),updated_at FROM game WHERE slug='unrelated';") == before_other, title
        assert sql("SELECT COUNT(*) FROM game_tag_map m JOIN game g ON g.id=m.game_id WHERE g.slug='unrelated';") == '0', title
        if tags is not False:
            actual = json.loads(sql("SELECT tags FROM game WHERE slug='landslide';"))
            expected = (tags or []) + ([] if tags and 'multiplayer' in tags else ['multiplayer'])
            assert actual == expected, (title, actual, expected)
            assert sql("SELECT COUNT(*) FROM game_tag_map m JOIN game g ON g.id=m.game_id WHERE g.slug='landslide' AND m.tag_slug='multiplayer';") == '1', title
        else:
            assert not first_map, title
        print(f'PASS {title}: tags preserved, repeat idempotent, unrelated game/map unchanged')
    print('MySQL 8 V109: 5 scenarios passed')
finally:
    docker('rm', '-f', container)
