"""Recorded GenAI walkthrough built from the tested app and benchmark results."""
import argparse, json, subprocess, tempfile
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT=Path(__file__).resolve().parents[3]
REPORT=ROOT/"gs/genai/evaluation.json"
CAPTURE=ROOT/"docs/gs/genai/prova-qwen-real.png"
OUTPUT=ROOT/"docs/gs/genai/demonstracao.mp4"
W,H=1280,720
PAPER="#FAFBF8"
INK="#163B2E"
MUTED="#52695E"
ACCENT="#147858"

def font(size,bold=False):
    path=Path("/usr/share/fonts/truetype/dejavu")/("DejaVuSans-Bold.ttf" if bold else "DejaVuSans.ttf")
    return ImageFont.truetype(str(path),size) if path.exists() else ImageFont.load_default(size=size)

def canvas(label):
    im=Image.new("RGB",(W,H),PAPER)
    d=ImageDraw.Draw(im)
    d.rounded_rectangle((39,37,1241,683),radius=25,fill="#FFFFFF",outline="#DAE7DE",width=2)
    d.rounded_rectangle((72,66,87,107),radius=6,fill=ACCENT)
    d.text((112,69),label.upper(),font=font(18,True),fill=ACCENT)
    d.line((75,132,1205,132),fill="#DFE9E3",width=2)
    return im,d

def lines(d,texts,x,y,size=40,spacing=59,color=INK,bold=True):
    for text in texts:
        d.text((x,y),text,font=font(size,bold),fill=color)
        y+=spacing

def paragraph(d,texts,x,y,size=22,spacing=38):
    lines(d,texts,x,y,size,spacing,MUTED,False)

def intro():
    im,d=canvas("Pátio Monitor · FIAP Global Solution 2026.2")
    lines(d,["IA que explica","divergências operacionais"],85,188,48,73)
    paragraph(d,["Comparação da escala com a portaria,","revisão humana e fontes verificáveis."],87,375,26,45)
    d.text((87,622),"Qwen2.5-0.5B-Instruct · RAG + agente · execução local",font=font(16),fill=MUTED)
    return im

def discrepancy():
    im,d=canvas("Caso de teste · dados fictícios")
    lines(d,["Uma saída, dois veículos"],83,160,43)
    for x,title,bus,time in [(83,"ESCALA","8 2361","06:15"),(672,"PORTARIA","7 8042","06:17")]:
        d.rounded_rectangle((x,271,x+520,482),radius=18,fill="#F0F6F1",outline="#CEE0D2",width=2)
        d.text((x+26,302),title,font=font(18,True),fill=ACCENT)
        d.text((x+26,351),bus,font=font(46,True),fill=INK)
        d.text((x+26,425),time,font=font(24),fill=MUTED)
    paragraph(d,["Fato calculado: os identificadores não coincidem.","A substituição física precisa ser verificada."],84,524,22,36)
    return im

def pipeline():
    im,d=canvas("Como funciona · produção e transparência")
    lines(d,["A IA não decide pela operação"],83,161,39)
    steps=[("01","CSV","Escala + portaria"),("02","Conciliação","Regras e divergências"),("03","Qwen + RAG","Regras citadas"),("04","Operador","Conferir e registrar")]
    for i,(num,name,detail) in enumerate(steps):
        x=78+(i%2)*590
        y=260+(i//2)*157
        d.rounded_rectangle((x,y,x+535,y+137),radius=16,fill="#F0F5F0",outline="#D5E5D9",width=2)
        d.text((x+24,y+20),num,font=font(18,True),fill=ACCENT)
        d.text((x+80,y+13),name,font=font(29,True),fill=INK)
        d.text((x+80,y+73),detail,font=font(18),fill=MUTED)
    paragraph(d,["O resultado cita fontes, pode recusar e preserva a decisão humana."],83,610,19)
    return im

def actual_screen():
    if not CAPTURE.is_file():
        raise FileNotFoundError(CAPTURE)
    source=Image.open(CAPTURE).convert("RGB")
    im,d=canvas("Execução real · navegador + Qwen local")
    crop=source.crop((20,189,650,895))
    crop.thumbnail((565,508),Image.Resampling.LANCZOS)
    im.paste(crop,(79,160))
    d.rounded_rectangle((665,173,1183,609),radius=19,fill="#EAF3ED",outline="#D2E5D7",width=2)
    lines(d,["O modelo","respondeu"],699,211,34,50)
    paragraph(d,["Caso PM-0615","Fonte p02 citada","Diagnóstico visível","Próxima ação indicada"],701,345,21,46)
    d.text((700,562),"Resultado medido em teste E2E.",font=font(16),fill=ACCENT)
    return im

def benchmark(scoreboard):
    im,d=canvas("Experimento · três configurações")
    lines(d,["Contexto reduz erros"],83,155,42)
    data=[("Sem contexto",scoreboard["baseline"]["correct_total"]),("Com RAG",scoreboard["rag"]["correct_total"]),("RAG + agente",scoreboard["rag_agent"]["correct_total"])]
    for i,(name,score) in enumerate(data):
        y=285+i*99
        d.text((84,y),name,font=font(23,True),fill=INK)
        d.rounded_rectangle((340,y+2,1018,y+33),radius=14,fill="#E5EDE6")
        d.rounded_rectangle((340,y+2,340+int(678*score/17),y+33),radius=14,fill=ACCENT if i==2 else "#80B19A")
        d.text((1044,y-3),f"{score}/17",font=font(24,True),fill=INK)
    paragraph(d,["Seis recusas corretas em seis perguntas sem evidência.","A amostra é pequena e não comprova precisão universal."],84,605,19,32)
    return im

def actions():
    im,d=canvas("Teste de aceitação · sem documentação externa")
    lines(d,["O professor pode testar em três ações"],83,166,34)
    entries=[("1","Iniciar teste guiado","Abre um caso com evidências."),("2","Explicar ocorrência","Consulta Qwen local e mostra fonte."),("3","Registrar conclusão","Operador confirma ou mantém pendência.")]
    for i,(num,title,detail) in enumerate(entries):
        y=271+i*116
        d.rounded_rectangle((82,y,1183,y+99),radius=15,fill="#F1F6F0",outline="#D8E5D9")
        d.text((106,y+19),num,font=font(32,True),fill=ACCENT)
        d.text((168,y+12),title,font=font(24,True),fill=INK)
        d.text((170,y+58),detail,font=font(18),fill=MUTED)
    return im

def outro():
    im,d=canvas("FIAP · Generative AI for Engineering")
    lines(d,["Código, métricas e fontes","publicados no GitHub"],84,178,44,69)
    paragraph(d,["17 questões avaliadas · 10 documentos indexados","Recusas, hashes e erros reais documentados."],84,383,24,45)
    d.text((84,587),"github.com/MachadONLY/patio-monitor-ia-generativa",font=font(20,True),fill=ACCENT)
    d.text((84,631),"Gabriel Machado · Felipe Bressani · Camila do Prado Padalino",font=font(16),fill=MUTED)
    return im

def run(args):
    subprocess.run(args,check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)

def make_video(destination):
    scores=json.loads(REPORT.read_text(encoding="utf-8"))["scoreboard"]
    scenes=[(7,intro()),(7,discrepancy()),(8,pipeline()),(12,actual_screen()),(9,benchmark(scores)),(9,actions()),(6,outro())]
    destination.parent.mkdir(parents=True,exist_ok=True)
    with tempfile.TemporaryDirectory() as td:
        root=Path(td)
        parts=[]
        for i,(seconds,im) in enumerate(scenes):
            still=root/f"{i}.png"
            part=root/f"{i}.mp4"
            im.save(still)
            run(["ffmpeg","-hide_banner","-loglevel","error","-y","-loop","1","-framerate","25","-i",str(still),"-t",str(seconds),"-vf","fps=25,format=yuv420p","-c:v","libx264","-preset","veryfast","-crf","24",str(part)])
            parts.append(part)
        manifest=root/"concat.txt"
        manifest.write_text("".join(f"file '{p}'\n" for p in parts),encoding="utf-8")
        run(["ffmpeg","-hide_banner","-loglevel","error","-y","-f","concat","-safe","0","-i",str(manifest),"-c","copy","-movflags","+faststart",str(destination)])
    print("Generated recorded GenAI demonstration:",destination,destination.stat().st_size)

if __name__=="__main__":
    p=argparse.ArgumentParser()
    p.add_argument("--output",type=Path,default=OUTPUT)
    make_video(p.parse_args().output)
