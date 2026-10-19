"""Generate deterministic test artwork with exact, reviewable text (Pillow required).
These are fictional engineering fixtures, not approved commercial labels.
"""
from PIL import Image, ImageDraw, ImageFont
from pathlib import Path
import json
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'public'/'samples'
OUT.mkdir(parents=True,exist_ok=True)
FONT='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
BOLD='/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
SERIF='/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf'
def font(size,bold=False,serif=False):return ImageFont.truetype(SERIF if serif else BOLD if bold else FONT,size)
WARNING='(1) According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects. (2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems.'
base=dict(beverage='spirits',brand='Old Tom Distillery',classType='Kentucky Straight Bourbon Whiskey',abv='45',netContents='750 mL',producer='Old Tom Distillery',address='Frankfort, Kentucky',imported=False,country='')
rows=[dict(id='DEMO-001',sample='clean',files=['old-tom-matching.png'],**base),dict(id='DEMO-002',sample='mismatch',files=['old-tom-discrepancies.png'],**base),dict(id='DEMO-003',sample='import',files=['maison-riviere-front.png','maison-riviere-back.png'],beverage='wine',brand='Maison Riviere',classType='Red Wine',abv='13.5',netContents='750 mL',producer='Maison Riviere',address='Bordeaux, France',imported=True,country='France')]
def wrap(draw,text,y,size=27,width=1050):
    f=font(size);line=''
    for word in text.split():
        next_line=(line+' '+word).strip()
        if draw.textlength(next_line,font=f)>width:
            draw.text((75,y),line,font=f,fill='#182e32');y+=40;line=word
        else:line=next_line
    if line:draw.text((75,y),line,font=f,fill='#182e32');y+=40
    return y
def canvas():
    im=Image.new('RGB',(1200,1050),'#fffdf6');d=ImageDraw.Draw(im);d.rectangle((28,28,1172,1022),outline='#426158',width=3);return im,d
for row in rows[:2]:
    im,d=canvas();d.text((600,75),'OLD TOM DISTILLERY',anchor='mt',font=font(61,serif=True),fill='#153b34')
    d.line((160,175,1040,175),fill='#b79553',width=3)
    d.text((600,220),'Kentucky Straight',anchor='mt',font=font(40),fill='#182e32');d.text((600,280),'Bourbon Whiskey',anchor='mt',font=font(46,bold=True),fill='#182e32')
    bad=row['sample']=='mismatch';abv='40% Alc./Vol. (80 Proof)' if bad else '45% Alc./Vol. (90 Proof)'
    d.text((600,385),abv,anchor='mt',font=font(36),fill='#182e32');d.text((600,445),'700 mL' if bad else '750 mL',anchor='mt',font=font(34),fill='#182e32')
    d.text((600,530),'Bottled by Old Tom Distillery',anchor='mt',font=font(29),fill='#182e32');d.text((600,575),'Frankfort, Kentucky',anchor='mt',font=font(29),fill='#182e32')
    d.line((75,655,1125,655),fill='#b79553',width=2)
    d.text((75,690),'Government Warning:' if bad else 'GOVERNMENT WARNING:',font=font(29,bold=True),fill='#182e32')
    wrap(d,WARNING.replace('may cause health problems','can cause health problems') if bad else WARNING,740)
    im.save(OUT/row['files'][0],optimize=True)
im,d=canvas();d.text((600,140),'MAISON RIVIERE',anchor='mt',font=font(70,serif=True),fill='#442334');d.line((200,255,1000,255),fill='#b79553',width=3);d.text((600,360),'Red Wine',anchor='mt',font=font(65),fill='#442334');d.text((600,535),'13.5% Alc./Vol.',anchor='mt',font=font(42),fill='#182e32');d.text((600,625),'0.75 L',anchor='mt',font=font(42),fill='#182e32');d.text((600,795),'Product of France',anchor='mt',font=font(32),fill='#182e32');im.save(OUT/rows[2]['files'][0],optimize=True)
im,d=canvas();d.text((600,100),'MAISON RIVIERE',anchor='mt',font=font(58,serif=True),fill='#442334');d.text((600,250),'Produced and bottled by Maison Riviere',anchor='mt',font=font(29),fill='#182e32');d.text((600,310),'Bordeaux, France',anchor='mt',font=font(33),fill='#182e32');d.text((600,430),'Product of France',anchor='mt',font=font(33),fill='#182e32');d.line((75,580,1125,580),fill='#b79553',width=2);d.text((75,640),'GOVERNMENT WARNING:',font=font(29,bold=True),fill='#182e32');wrap(d,WARNING,695);im.save(OUT/rows[2]['files'][1],optimize=True)
(OUT/'batch-manifest.json').write_text(json.dumps(rows,indent=2)+'\n')
print('Created four sample images and a three-application manifest.')
