import sys
from sqlmodel import Session, select
from app.database import engine, create_db_and_tables
from app.models import VideoStream, Scene, SceneStream, AppSetting
from app.schemas import POSITIONS

def seed():
    print("Initializing database tables...")
    create_db_and_tables()

    with Session(engine) as session:
        print("Clearing existing video streams, scenes, and settings...")
        # Delete existing data to avoid conflicts
        for x in session.exec(select(SceneStream)).all():
            session.delete(x)
        for x in session.exec(select(Scene)).all():
            session.delete(x)
        for x in session.exec(select(VideoStream)).all():
            session.delete(x)
        
        active_setting = session.get(AppSetting, "active_scene_id")
        if active_setting:
            session.delete(active_setting)
        
        session.commit()

        print("Adding video streams...")
        streams = []
        for i in range(1, 9):
            stream = VideoStream(
                name=f"Camera {i}",
                mediamtx_path=f"cam{i}-main",
                display_order=i - 1
            )
            session.add(stream)
            streams.append(stream)
        
        session.commit()
        for stream in streams:
            session.refresh(stream)

        print("Adding scenes...")
        scene_1_4 = Scene(name="カメラ 1～4", display_order=0)
        scene_5_8 = Scene(name="カメラ 5～8", display_order=1)
        session.add(scene_1_4)
        session.add(scene_5_8)
        
        session.commit()
        session.refresh(scene_1_4)
        session.refresh(scene_5_8)

        print("Assigning streams to scenes...")
        # Assign cam1-main to cam4-main to scene_1_4
        for stream, position in zip(streams[:4], POSITIONS, strict=True):
            session.add(SceneStream(
                scene_id=scene_1_4.id,
                stream_id=stream.id,
                position=position
            ))
            
        # Assign cam5-main to cam8-main to scene_5_8
        for stream, position in zip(streams[4:8], POSITIONS, strict=True):
            session.add(SceneStream(
                scene_id=scene_5_8.id,
                stream_id=stream.id,
                position=position
            ))

        # Set active scene to scene 1-4
        session.add(AppSetting(key="active_scene_id", value=scene_1_4.id))
        
        session.commit()
        print("Database seeded successfully!")
        
        # Print summary of inserted data
        print("\n--- Seeded Video Streams ---")
        for stream in session.exec(select(VideoStream)).all():
            print(f"ID: {stream.id} | Name: {stream.name} | Path: {stream.mediamtx_path} | Order: {stream.display_order}")
            
        print("\n--- Seeded Scenes ---")
        for scene in session.exec(select(Scene)).all():
            print(f"ID: {scene.id} | Name: {scene.name} | Order: {scene.display_order}")
            placements = session.exec(select(SceneStream).where(SceneStream.scene_id == scene.id)).all()
            for p in placements:
                s = session.get(VideoStream, p.stream_id)
                print(f"  └ Position: {p.position} -> Stream: {s.name} ({s.mediamtx_path})")

if __name__ == "__main__":
    seed()
